/**
 * Server mesajları — Azərbaycan dili (əsas / fallback dil).
 * Yer tutucular: {name}. Cəm formaları: { one, other } (bax utils/i18n.js).
 */
export default {
  lang: { name: "Azərbaycan dili" },

  common: {
    endpointNotFound: "Sorğu ünvanı tapılmadı",
    serverError: "Serverdə xəta baş verdi. Bir az sonra yenidən cəhd edin.",
    validation: "Məlumatlar düzgün deyil",
    duplicate: "Bu qeyd artıq mövcuddur",
    sessionExpired: "Sessiyanın vaxtı bitib — yenidən daxil olun",
    rateLimit: "Çox sayda sorğu. Bir dəqiqə sonra yenidən cəhd edin.",
    loginRateLimit: "Çox sayda uğursuz cəhd. 15 dəqiqə gözləyin.",
    writeRateLimit:
      "Çox sayda dəyişiklik sorğusu. Bir az sonra yenidən cəhd edin.",
    invalidPoint: "{label}: koordinatlar düzgün deyil",
    invalidLatLng: "Koordinatlar düzgün deyil",
    fileTooLarge: "Fayl çox böyükdür. Maksimum: {mb} MB",
  },

  crowd: { low: "Az", mid: "Orta", high: "Yüksək", unknown: "Məlumat yoxdur" },
  trend: { up: "artır", down: "azalır", flat: "sabit", new: "yeni" },

  route: {
    notFound: "Xətt tapılmadı",
    stopNotFound: "Dayanacaq tapılmadı",
    busNotFound: "Avtobus tapılmadı",
    busWrongRoute: "Bu avtobus seçilmiş xəttə aid deyil",
  },

  report: {
    invalidLevel: "Sıxlıq səviyyəsini seçin: az, orta və ya yüksək",
    deviceRequired: "Cihaz identifikatoru tələb olunur",
    cooldown:
      "Bu xətt üçün yenidən {seconds} saniyədən sonra bildirə bilərsiniz",
    thanksVerified: "Təşəkkürlər! Bildirişiniz GPS ilə təsdiqləndi.",
    thanksUnverified:
      "Təşəkkürlər! Bildiriş qəbul edildi — GPS təsdiqi olmadan daha az çəki ilə nəzərə alınır.",
    rateLimit: "Çox sayda bildiriş. Bir az sonra yenidən cəhd edin.",
  },

  intent: {
    confirmed: "Səfəriniz qeydə alındı",
    cancelled: "Səfər ləğv edildi",
    invalidLegs: "Marşrut mərhələləri düzgün deyil",
  },

  alert: {
    notFound: "Xəbərdarlıq tapılmadı",
    alreadyResolved: "Bu xəbərdarlıq artıq bağlanıb",
    invalidAction: "Əməliyyat: acknowledge, dispatch və ya resolve",
    dispatched: "{count} ehtiyat avtobus ayrıldı",
    note: {
      auto_crowd: "Avtomatik yaradıldı (crowdsourcing)",
      auto_demand: "Proaktiv tələb proqnozu",
      command: "Əmr: {title}",
    },
  },

  dispatch: {
    textTooLong: "Əmr mətni çox uzundur (maks. {max} simvol)",
    unknownType: "Naməlum əmr tipi",
    emptyText: "Əmr mətni boşdur",
    sent: "Əmr göndərildi",
  },

  ai: {
    messagesRequired: "Mesaj boşdur — sualınızı yazın",
    rateLimit: "AI sorğu limiti aşıldı. Bir dəqiqə sonra yenidən cəhd edin.",
  },

  demo: { invalidLevel: "Səviyyə yanlışdır (low | mid | high)" },

  // Dispetçer tövsiyəsinin səbəbləri (DispatchService reasons[].code)
  reason: {
    reserves_on_line: "Artıq {count} ehtiyat avtobus xəttdədir",
    crowd_live:
      "Crowdsourcing: sıxlıq balı {score} ({total} bildiriş, {verified} GPS-təsdiqli) → təxmini doluluq {loadPct}%",
    forecast_next:
      "Proqnoz: saat {hour}:00 üçün «{levelLabel}» ({loadPct}% doluluq, etibar {confidencePct}%)",
    demand_intents:
      "Tələb (A): {intents} «Gedirəm» → tətbiq payı {appSharePct}% fərziyyəsi ilə ~{pax} sərnişin",
    live_riders:
      "Canlı lokasiya (B): hazırda bu xəttin avtobuslarında ~{riders} sərnişin",
    hot_segments: "Ən sıx hissə: {segments}",
    alert_min_one:
      "Aktiv «Yüksək sıxlıq» xəbərdarlığı — minimum 1 ehtiyat avtobus",
    limit_max: "Limit: bir xəbərdarlıq üçün maks. {max} ehtiyat avtobus",
  },

  // Operator: qayda əsaslı xülasə (AI açarı olmadıqda)
  summary: {
    crowd:
      "№{number} xəttində son {windowMin} dəqiqədə {total} bildiriş var, ümumi sıxlıq «{levelLabel}» (trend: {trendLabel}).",
    noReports: "№{number} xəttində son dəqiqələrdə bildiriş yoxdur.",
    load: "Təxmini doluluq: {loadPct}%.",
    hot: "Ən sıx hissə: {segment}.",
    forecast: "Proqnoz: saat {hour}:00-da «{levelLabel}».",
    demand: "{count} sərnişin yaxın 30 dəqiqədə getməyi təsdiqləyib.",
    recommend:
      "Tövsiyə: {count} ehtiyat avtobus (interval {before} → {after} dəq).",
    noNeed: "Hazırda əlavə avtobus tələb olunmur.",
  },

  // Operator: 1–2 saatlıq proqnoz (PredictionService, Gemini olmadıqda)
  predict: {
    reason: {
      ongoing:
        "Hazırda ~{nowPct}% doluluq; növbəti saatda da ~{nextPct}% gözlənilir.",
      forecast:
        "Tarixi profil + canlı vəziyyət: ~{loadPct}% doluluq gözlənilir (etibar {confidencePct}%).",
      weather: "Hava ({condition}) sərnişin axınını artırır.",
      traffic: "Sıx tıxac reys sayını azaldır.",
    },
    realloc: {
      donor:
        "№{from} xəttində doluluq {fromLoad}%-dən çox olmayacaq — 1 avtobusu №{to} xəttinə ({toLoad}%) yönəldin.",
      depot: {
        one: "Ehtiyat parkdan {count} avtobus №{to} xəttinə ({toLoad}%).",
        other: "Ehtiyat parkdan {count} avtobus №{to} xəttinə ({toLoad}%).",
      },
    },
    summary: {
      ongoing: {
        one: "{list} xəttində yüksək sıxlıq davam edir.",
        other: "{list} xətlərində yüksək sıxlıq davam edir.",
      },
      spikes: {
        one: "Növbəti 2 saatda {count} xətt üzrə sıxlıq sıçrayışı gözlənilir: {list}.",
        other:
          "Növbəti 2 saatda {count} xətt üzrə sıxlıq sıçrayışı gözlənilir: {list}.",
      },
      calm: "Növbəti 2 saatda kəskin sıxlıq artımı gözlənilmir.",
      weather: "Hava: {condition}, {temp}°C.",
      traffic: "Tıxac: {level}.",
    },
    weather: {
      clear: "aydın",
      cloudy: "buludlu",
      fog: "duman",
      drizzle: "çiskin",
      rain: "yağış",
      snow: "qar",
      storm: "tufan",
      unknown: "məlum deyil",
    },
    traffic: { light: "az", moderate: "orta", heavy: "sıx" },
  },
  // Sərnişin chatbot — qayda əsaslı rejim
  chat: {
    help: "Marşrut və sıxlıq üzrə kömək edə bilərəm. Məsələn: «Sahildən Koroğluya necə gedim?», «5 nömrəli avtobus sıxdır?», «Ən az sıx avtobus hansıdır?»",
    routeNotFound: "№{number} xətti tapılmadı",
    stopNotOnRoute: "«{stop}» dayanacağı bu xətdə yoxdur",
    endpointsNotFound: "Başlanğıc və ya təyinat dayanacağı tapılmadı",
    noTrip: "Bu dayanacaqlar arasında uyğun marşrut tapılmadı.",
    tripBest:
      "{from} → {to}: ən yaxşı variant {summary}, ~{min} dəq (sıxlıq: {crowd}). Addımlar: {steps}.",
    stepWalk: "piyada {meters} m",
    stepBus:
      "№{number} avtobusu {from} → {to} ({wait} dəq gözləmə, {stops} dayanacaq, sıxlıq: {crowd})",
    walkOnly: "Piyada",
    leastCrowded: "Hazırda ən az sıx xətt: №{number} ({name}) — «{crowd}».",
    notEnoughData:
      "Hələ kifayət qədər bildiriş yoxdur — sıxlığı bildirməklə kömək edə bilərsiniz.",
    routeStatus:
      "№{number} ({name}): sıxlıq «{crowd}», xəttdə {buses} avtobus, interval ~{headway} dəq.",
  },

  // Auth mesajları
  auth: {
    fillRequired: "Bütün vacib sahələri doldurun",
    passwordMin: "Parol ən azı 8 simvol olmalıdır",
    emailTaken: "Bu e-poçt artıq qeydiyyatdan keçib",
    emailSendFailed: "E-poçt göndərilmədi. Yenidən cəhd edin",
    emailSendFailedShort: "E-poçt göndərilmədi",
    codeSent: "Təsdiq kodu e-poçtunuza göndərildi",
    emailCodeRequired: "E-poçt və təsdiq kodu tələb olunur",
    registered: "Qeydiyyat uğurla tamamlandı",
    emailRequired: "E-poçt tələb olunur",
    noPending: "Gözləyən təsdiq tapılmadı. Yenidən başlayın",
    codeResent: "Yeni təsdiq kodu göndərildi",
    emailPasswordRequired: "E-poçt və parol tələb olunur",
    invalidCredentials: "E-poçt və ya parol yanlışdır",
    accountInactive: "Hesabınız aktiv deyil",
    loginSuccess: "Uğurla daxil oldunuz",
    logoutSuccess: "Hesabdan çıxdınız",
    passwordsRequired: "Cari və yeni parol tələb olunur",
    newPasswordMin: "Yeni parol ən azı 8 simvol olmalıdır",
    currentPasswordWrong: "Cari parol yanlışdır",
    passwordChanged: "Parol dəyişdirildi",
    resetIfExists: "Bu e-poçt mövcuddursa, bərpa kodu göndərildi",
    resetSent: "Bərpa kodu e-poçtunuza göndərildi",
    userNotFound: "İstifadəçi tapılmadı",
    otpVerified: "Kod təsdiqləndi",
    newPasswordRequired: "Yeni parol tələb olunur",
    passwordReset: "Parol yeniləndi",
    profileUpdated: "Profil yeniləndi",
    avatarRequired: "Şəkil faylı tələb olunur",
    avatarUpdated: "Profil şəkli yeniləndi",
    authRequired: "Daxil olmaq tələb olunur",
    accountNotFoundInactive: "Hesab tapılmadı və ya aktiv deyil",
    sessionExpiredRelogin: "Sessiyanın vaxtı bitib, yenidən daxil olun",
    sessionExpired: "Sessiyanın vaxtı bitib",
    invalidToken: "Token etibarsızdır",
    refreshRequired: "Yeniləmə tokeni tələb olunur",
    accountNotFound: "Hesab tapılmadı",
    invalidRefresh: "Yeniləmə tokeni etibarsızdır",
    resetTokenRequired: "Bərpa tokeni tələb olunur",
    resetTokenInvalidExpired: "Bərpa tokeni etibarsızdır və ya vaxtı bitib",
    resetTokenInvalid: "Bərpa tokeni etibarsızdır",
    forbidden: "Bu əməliyyat üçün icazəniz yoxdur",
    otp: {
      notFound: "Kod tapılmadı və ya vaxtı bitib",
      tooManyAttempts: "Çox sayda yanlış cəhd. Yeni kod istəyin",
      invalid: "Kod yanlışdır",
      expired: "Kodun vaxtı bitib",
    },
  },
};
