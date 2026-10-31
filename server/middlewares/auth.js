import { jwt } from "#lib";
import { config } from "#config";
import { User } from "#models";
import { AuthTokenService } from "#services/AuthTokenService.js";
import { operatorRoles } from "#constants";
import { t } from "#utils";

/**
 * Authenticate an access token and attach the user to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.authRequired"),
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, config.accessSecretKey);

    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isDeleted || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.accountNotFoundInactive"),
      });
    }

    // Check token version (for "logout all devices")
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.sessionExpiredRelogin"),
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.sessionExpired"),
        code: "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.invalidToken"),
    });
  }
};

/**
 * Authenticate a refresh token and attach the user to req.user.
 */
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.refreshRequired"),
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, config.refreshSecretKey);

    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.accountNotFound"),
      });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.sessionExpired"),
      });
    }

    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.invalidRefresh"),
    });
  }
};

/**
 * Authenticate a password-reset token (read from header or body.resetToken).
 * Attaches req.resetData and req.user.
 */
const authenticateResetToken = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "");
    } else if (req.body?.resetToken) {
      token = req.body.resetToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.resetTokenRequired"),
      });
    }

    const decoded = AuthTokenService.verifyResetToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.resetTokenInvalidExpired"),
      });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.accountNotFound"),
      });
    }

    req.resetData = { email: decoded.email, userId: decoded.userId };
    req.user = user;
    next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: t(req.lang, "auth.resetTokenInvalid"),
    });
  }
};

/**
 * Require the authenticated user to have one of the allowed roles.
 * @param {Array<string>} allowedRoles
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: t(req.lang, "auth.authRequired"),
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: t(req.lang, "auth.forbidden"),
      });
    }

    next();
  };
};

/**
 * Yalnız dispetçer paneli rolları (operator, admin).
 */
const requireOperator = requireRole(operatorRoles);

export {
  requireOperator,
  authenticate,
  authenticateRefreshToken,
  authenticateResetToken,
  requireRole,
};
