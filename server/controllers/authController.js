// Models
import { OTP, User } from "#models";

// Services
import {
  FileService,
  HashService,
  MailService,
  AuthTokenService,
} from "#services";

// Utils
import { asyncHandler, t } from "#utils";

// Config
import { config } from "#config";

// Constants
import { uploadPaths } from "#constants";

/**
 * Build the public-safe user object returned to clients.
 */
const toUserResponse = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  status: user.status,
});

/**
 * Issue tokens for a user and set them as httpOnly cookies.
 */
const issueTokens = (res, user, rememberMe = false) => {
  const tokens = AuthTokenService.generateTokens(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    rememberMe,
  );

  const refreshMaxAge = rememberMe
    ? config.rememberMeMaxAge
    : config.refreshTokenMaxAge;

  res.cookie(config.accessCookieName, tokens.accessToken, {
    ...config.cookie,
    maxAge: config.accessTokenMaxAge,
  });
  res.cookie(config.refreshCookieName, tokens.refreshToken, {
    ...config.cookie,
    maxAge: refreshMaxAge,
  });

  return tokens;
};

/**
 * Step 1: Send OTP for registration
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.fillRequired"),
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.passwordMin"),
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.emailTaken"),
    });
  }

  // Hash the password now; store it in the OTP payload until verification.
  const hashedPassword = await HashService.hashPassword(password);

  const otp = await OTP.createOTP(email, "register", {
    firstName,
    lastName,
    phone: phone || null,
    hashedPassword,
  });

  const emailResult = await MailService.sendOTP(email, otp.code, "register");

  if (!emailResult.success) {
    await OTP.deleteOne({ _id: otp._id });
    return res.status(500).json({
      success: false,
      message: t(req.lang, "auth.emailSendFailed"),
    });
  }

  res.status(200).json({
    success: true,
    message: t(req.lang, "auth.codeSent"),
    data: { email: email.toLowerCase(), expiresIn: config.otpExpiresIn },
  });
});

/**
 * Step 2: Verify OTP and create the user
 * POST /api/auth/verify-otp
 */
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.emailCodeRequired"),
    });
  }

  const verification = await OTP.verifyOTP(email, code, "register");

  if (!verification.valid) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, `auth.otp.${verification.errorKey || "invalid"}`),
    });
  }

  const data = verification.data;

  // Create the user from the stored OTP payload.
  const user = await User.create({
    firstName: data.firstName,
    lastName: data.lastName,
    email: email.toLowerCase(),
    password: data.hashedPassword,
    phone: data.phone || null,
  });

  await OTP.deleteMany({ email: email.toLowerCase(), type: "register" });

  // Fire-and-forget welcome email (do not block the response on it).
  MailService.sendWelcome(user.email, user.firstName).catch(() => {});

  const tokens = issueTokens(res, user);

  res.status(201).json({
    success: true,
    message: t(req.lang, "auth.registered"),
    data: { user: toUserResponse(user), tokens },
  });
});

/**
 * Resend OTP code
 * POST /api/auth/resend-otp
 */
const resendOTP = asyncHandler(async (req, res) => {
  const { email, type = "register" } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: t(req.lang, "auth.emailRequired") });
  }

  const existingOTP = await OTP.findOne({
    email: email.toLowerCase(),
    type,
    verified: false,
  });

  if (!existingOTP) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.noPending"),
    });
  }

  const otp = await OTP.createOTP(email, type, existingOTP.data);
  const emailResult = await MailService.sendOTP(email, otp.code, type);

  if (!emailResult.success) {
    return res.status(500).json({
      success: false,
      message: t(req.lang, "auth.emailSendFailedShort"),
    });
  }

  res.json({
    success: true,
    message: t(req.lang, "auth.codeResent"),
    data: { email: email.toLowerCase(), expiresIn: config.otpExpiresIn },
  });
});

/**
 * Login
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.emailPasswordRequired"),
    });
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.invalidCredentials"),
    });
  }

  const isMatch = await HashService.comparePassword(password, user.password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.invalidCredentials"),
    });
  }

  if (user.status !== "active") {
    return res.status(403).json({
      success: false,
      message: t(req.lang, "auth.accountInactive"),
    });
  }

  user.lastLogin = new Date();
  await user.save();

  const tokens = issueTokens(res, user, !!rememberMe);

  res.json({
    success: true,
    message: t(req.lang, "auth.loginSuccess"),
    data: { user: toUserResponse(user), tokens },
  });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  const user = req.user;

  // Detect rememberMe by inspecting the old refresh token's lifetime.
  const authHeader = req.header("Authorization");
  const oldRefreshToken = authHeader?.replace("Bearer ", "");
  const decoded = AuthTokenService.verifyRefreshToken(oldRefreshToken);
  const tokenLifeMs =
    decoded?.exp && decoded?.iat ? (decoded.exp - decoded.iat) * 1000 : 0;
  const rememberMe = tokenLifeMs > 7 * 24 * 60 * 60 * 1000;

  const tokens = issueTokens(res, user, rememberMe);

  res.json({ success: true, data: { tokens } });
});

/**
 * Logout (invalidate all tokens on all devices)
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const user = req.user;

  user.tokenVersion += 1;
  await user.save();

  res.clearCookie(config.accessCookieName, config.cookie);
  res.clearCookie(config.refreshCookieName, config.cookie);

  res.json({ success: true, message: t(req.lang, "auth.logoutSuccess") });
});

/**
 * Get current user
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  res.json({ success: true, data: { user: toUserResponse(user) } });
});

/**
 * Change password (while logged in)
 * PUT /api/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.passwordsRequired"),
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.newPasswordMin"),
    });
  }

  const user = await User.findById(req.user._id);

  const isMatch = await HashService.comparePassword(
    currentPassword,
    user.password,
  );
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.currentPasswordWrong"),
    });
  }

  user.password = await HashService.hashPassword(newPassword);
  user.tokenVersion += 1; // invalidate existing sessions
  await user.save();

  const tokens = issueTokens(res, user);

  res.json({
    success: true,
    message: t(req.lang, "auth.passwordChanged"),
    data: { tokens },
  });
});

/**
 * Forgot password - Step 1: send OTP
 * POST /api/auth/forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: t(req.lang, "auth.emailRequired") });
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to avoid email enumeration.
  if (!user) {
    return res.json({
      success: true,
      message: t(req.lang, "auth.resetIfExists"),
      data: { email: email.toLowerCase(), expiresIn: config.otpExpiresIn },
    });
  }

  const otp = await OTP.createOTP(email, "reset-password", {
    userId: user._id,
  });
  const emailResult = await MailService.sendOTP(
    email,
    otp.code,
    "reset-password",
  );

  if (!emailResult.success) {
    await OTP.deleteOne({ _id: otp._id });
    return res.status(500).json({
      success: false,
      message: t(req.lang, "auth.emailSendFailed"),
    });
  }

  res.json({
    success: true,
    message: t(req.lang, "auth.resetSent"),
    data: { email: email.toLowerCase(), expiresIn: config.otpExpiresIn },
  });
});

/**
 * Forgot password - Step 2: verify OTP, return reset token
 * POST /api/auth/verify-reset-otp
 */
const verifyResetOTP = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.emailCodeRequired"),
    });
  }

  const verification = await OTP.verifyOTP(email, code, "reset-password");

  if (!verification.valid) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, `auth.otp.${verification.errorKey || "invalid"}`),
    });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: t(req.lang, "auth.userNotFound") });
  }

  await OTP.deleteMany({ email: email.toLowerCase(), type: "reset-password" });

  const resetToken = AuthTokenService.generateResetToken({
    email: email.toLowerCase(),
    userId: user._id,
  });

  res.json({
    success: true,
    message: t(req.lang, "auth.otpVerified"),
    data: { resetToken },
  });
});

/**
 * Forgot password - Step 3: reset password (protected by reset token)
 * POST /api/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  const user = req.user;

  if (!newPassword) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.newPasswordRequired"),
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.passwordMin"),
    });
  }

  user.password = await HashService.hashPassword(newPassword);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  res.json({ success: true, message: t(req.lang, "auth.passwordReset") });
});

/**
 * Update profile
 * PUT /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res
      .status(404)
      .json({ success: false, message: t(req.lang, "auth.userNotFound") });
  }

  if (firstName) user.firstName = firstName.trim();
  if (lastName) user.lastName = lastName.trim();
  if (phone !== undefined) user.phone = phone;

  await user.save();

  res.json({
    success: true,
    message: t(req.lang, "auth.profileUpdated"),
    data: { user: toUserResponse(user) },
  });
});

/**
 * Update avatar (FileService upload example)
 * PUT /api/auth/avatar
 */
const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.files || !req.files.avatar) {
    return res.status(400).json({
      success: false,
      message: t(req.lang, "auth.avatarRequired"),
    });
  }

  const user = await User.findById(req.user._id);

  // Remove the previous avatar file if present.
  if (user.avatar) {
    FileService.deleteFile(user.avatar);
  }

  const savedFile = await FileService.saveFile(
    req.files.avatar,
    `${uploadPaths.avatars.replace("uploads/", "")}/${user._id}`,
  );

  user.avatar = savedFile.path;
  await user.save();

  res.json({
    success: true,
    message: t(req.lang, "auth.avatarUpdated"),
    data: { avatar: user.avatar },
  });
});

export {
  register,
  verifyOTP,
  resendOTP,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  updateProfile,
  updateAvatar,
};
