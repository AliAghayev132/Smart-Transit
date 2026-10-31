/**
 * Server messages — English.
 * Placeholders: {name}. Plural forms: { one, other } (see utils/i18n.js).
 */
export default {
  lang: { name: "English" },

  common: {
    endpointNotFound: "Endpoint not found",
    serverError:
      "Something went wrong on the server. Please try again shortly.",
    validation: "Some fields are invalid",
    duplicate: "This record already exists",
    sessionExpired: "Your session has expired — please sign in again",
    rateLimit: "Too many requests. Try again in a minute.",
    loginRateLimit: "Too many failed attempts. Please wait 15 minutes.",
    writeRateLimit: "Too many requests. Please slow down.",
    invalidPoint: "{label}: invalid coordinates",
    invalidLatLng: "Invalid coordinates",
    fileTooLarge: "File too large. Max size: {mb} MB",
  },

  crowd: { low: "Low", mid: "Medium", high: "High", unknown: "No data" },
  trend: { up: "rising", down: "falling", flat: "steady", new: "new" },

  route: {
    notFound: "Route not found",
    stopNotFound: "Stop not found",
    busNotFound: "Bus not found",
    busWrongRoute: "This bus isn't on the selected route",
  },

  report: {
    invalidLevel: "Pick a crowding level: low, medium or high",
    deviceRequired: "A device ID is required",
    cooldown: "You can report this route again in {seconds} s",
    thanksVerified: "Thanks! Your report was verified by GPS.",
    thanksUnverified:
      "Thanks! Report received — without GPS it counts with less weight.",
    rateLimit: "Too many reports. Please try again in a moment.",
  },

  intent: {
    confirmed: "Your trip is saved",
    cancelled: "Trip cancelled",
    invalidLegs: "Invalid itinerary legs",
  },

  alert: {
    notFound: "Alert not found",
    alreadyResolved: "This alert is already closed",
    invalidAction: "Action must be acknowledge, dispatch or resolve",
    dispatched: {
      one: "{count} reserve bus dispatched",
      other: "{count} reserve buses dispatched",
    },
    note: {
      auto_crowd: "Created automatically (crowdsourcing)",
      auto_demand: "Proactive demand forecast",
      command: "Command: {title}",
    },
  },

  dispatch: {
    textTooLong: "Command text is too long (max {max} characters)",
    unknownType: "Unknown command type",
    emptyText: "The command text is empty",
    sent: "Command sent",
  },

  ai: {
    messagesRequired: "Message is empty — type your question",
    rateLimit: "AI request limit reached. Try again in a minute.",
  },

  demo: { invalidLevel: "Invalid level (low | mid | high)" },

  reason: {
    reserves_on_line: {
      one: "{count} reserve bus is already on the route",
      other: "{count} reserve buses are already on the route",
    },
    crowd_live:
      "Crowdsourcing: crowd score {score} ({total} reports, {verified} GPS-verified) → estimated load {loadPct}%",
    forecast_next:
      "Forecast for {hour}:00: {levelLabel} ({loadPct}% load, {confidencePct}% confidence)",
    demand_intents:
      "Demand (A): {intents} “I'm going” taps → assuming a {appSharePct}% app share, ~{pax} passengers",
    live_riders:
      "Live location (B): ~{riders} passengers on this route's buses right now",
    hot_segments: "Most crowded section: {segments}",
    alert_min_one: "Active “high crowding” alert — at least 1 reserve bus",
    limit_max: "Limit: max {max} reserve buses per alert",
  },

  summary: {
    crowd:
      "Route {number}: {total} reports in the last {windowMin} min, overall crowding {levelLabel} (trend: {trendLabel}).",
    noReports: "Route {number}: no reports in the last few minutes.",
    load: "Estimated load: {loadPct}%.",
    hot: "Most crowded section: {segment}.",
    forecast: "Forecast for {hour}:00: {levelLabel}.",
    demand: {
      one: "{count} passenger confirmed they're travelling in the next 30 min.",
      other:
        "{count} passengers confirmed they're travelling in the next 30 min.",
    },
    recommend: {
      one: "Recommendation: {count} reserve bus (headway {before} → {after} min).",
      other:
        "Recommendation: {count} reserve buses (headway {before} → {after} min).",
    },
    noNeed: "No extra buses needed right now.",
  },

  // Operator: 1–2 hour prediction (PredictionService, when Gemini is off)
  predict: {
    reason: {
      ongoing:
        "Currently ~{nowPct}% occupancy; ~{nextPct}% still expected next hour.",
      forecast:
        "Historical profile + live state: ~{loadPct}% occupancy expected ({confidencePct}% confidence).",
      weather: "Weather ({condition}) increases ridership.",
      traffic: "Heavy traffic reduces the number of trips.",
    },
    realloc: {
      donor:
        "Route №{from} stays at or below {fromLoad}% — move 1 bus to №{to} ({toLoad}%).",
      depot: {
        one: "{count} reserve bus from the depot to №{to} ({toLoad}%).",
        other: "{count} reserve buses from the depot to №{to} ({toLoad}%).",
      },
    },
    summary: {
      ongoing: {
        one: "High crowding continues on {list}.",
        other: "High crowding continues on {list}.",
      },
      spikes: {
        one: "A crowding spike is expected on {count} route in the next 2 hours: {list}.",
        other:
          "Crowding spikes are expected on {count} routes in the next 2 hours: {list}.",
      },
      calm: "No sharp crowding increase is expected in the next 2 hours.",
      weather: "Weather: {condition}, {temp}°C.",
      traffic: "Traffic: {level}.",
    },
    weather: {
      clear: "clear",
      cloudy: "cloudy",
      fog: "fog",
      drizzle: "drizzle",
      rain: "rain",
      snow: "snow",
      storm: "storm",
      unknown: "unknown",
    },
    traffic: { light: "light", moderate: "moderate", heavy: "heavy" },
  },
  chat: {
    help: "I can help with routes and crowding. Try: “How do I get from Sahil to Koroglu?”, “Is bus 5 crowded?”, “Which bus is least crowded?”",
    routeNotFound: "Route {number} not found",
    stopNotOnRoute: "Stop “{stop}” isn't on this route",
    endpointsNotFound: "Couldn't find the start or destination stop",
    noTrip: "No suitable route between these stops.",
    tripBest:
      "{from} → {to}: best option {summary}, ~{min} min (crowding: {crowd}). Steps: {steps}.",
    stepWalk: "walk {meters} m",
    stepBus:
      "bus {number} {from} → {to} ({wait} min wait, {stops} stops, crowding: {crowd})",
    walkOnly: "Walk",
    leastCrowded: "Least crowded right now: route {number} ({name}) — {crowd}.",
    notEnoughData:
      "Not enough reports yet — you can help by reporting how crowded your bus is.",
    routeStatus:
      "Route {number} ({name}): crowding: {crowd}, {buses} buses running, every ~{headway} min.",
  },

  auth: {
    fillRequired: "Please fill in all required fields",
    passwordMin: "Password must be at least 8 characters",
    emailTaken: "This email is already registered",
    emailSendFailed: "Could not send email. Please try again",
    emailSendFailedShort: "Could not send email",
    codeSent: "Verification code sent to your email",
    emailCodeRequired: "Email and verification code are required",
    registered: "Registration completed successfully",
    emailRequired: "Email is required",
    noPending: "No pending verification found. Please start again",
    codeResent: "A new verification code has been sent",
    emailPasswordRequired: "Email and password are required",
    invalidCredentials: "Invalid email or password",
    accountInactive: "Your account is not active",
    loginSuccess: "Signed in successfully",
    logoutSuccess: "Signed out",
    passwordsRequired: "Current and new password are required",
    newPasswordMin: "New password must be at least 8 characters",
    currentPasswordWrong: "Current password is incorrect",
    passwordChanged: "Password changed successfully",
    resetIfExists: "If this email exists, a reset code has been sent",
    resetSent: "Reset code sent to your email",
    userNotFound: "User not found",
    otpVerified: "Code verified",
    newPasswordRequired: "New password is required",
    passwordReset: "Password reset successfully",
    profileUpdated: "Profile updated",
    avatarRequired: "Avatar file is required",
    avatarUpdated: "Avatar updated",
    authRequired: "Please sign in to continue",
    accountNotFoundInactive: "Account not found or inactive",
    sessionExpiredRelogin: "Session expired, please sign in again",
    sessionExpired: "Session expired",
    invalidToken: "Invalid token",
    refreshRequired: "Refresh token required",
    accountNotFound: "Account not found",
    invalidRefresh: "Invalid refresh token",
    resetTokenRequired: "Reset token required",
    resetTokenInvalidExpired: "Invalid or expired reset token",
    resetTokenInvalid: "Invalid reset token",
    forbidden: "You do not have permission for this action",
    otp: {
      notFound: "Code not found or expired",
      tooManyAttempts: "Too many invalid attempts. Request a new code",
      invalid: "Invalid code",
      expired: "The code has expired",
    },
  },
};
