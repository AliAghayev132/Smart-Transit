/**
 * Сообщения сервера — русский язык.
 * Плейсхолдеры: {name}. Формы множественного числа: { one, few, many, other } (см. utils/i18n.js).
 */
export default {
  lang: { name: "Русский" },

  common: {
    endpointNotFound: "Адрес запроса не найден",
    serverError: "Ошибка на сервере. Повторите попытку чуть позже.",
    validation: "Некоторые поля заполнены неверно",
    duplicate: "Такая запись уже существует",
    sessionExpired: "Сессия истекла — войдите снова",
    rateLimit: "Слишком много запросов. Повторите через минуту.",
    loginRateLimit: "Слишком много неудачных попыток. Подождите 15 минут.",
    writeRateLimit: "Слишком много запросов. Пожалуйста, помедленнее.",
    invalidPoint: "{label}: неверные координаты",
    invalidLatLng: "Неверные координаты",
    fileTooLarge: "Файл слишком большой. Максимум: {mb} МБ",
  },

  crowd: {
    low: "Низкая",
    mid: "Средняя",
    high: "Высокая",
    unknown: "Нет данных",
  },
  trend: {
    up: "растёт",
    down: "снижается",
    flat: "стабильна",
    new: "новые данные",
  },

  route: {
    notFound: "Маршрут не найден",
    stopNotFound: "Остановка не найдена",
    busNotFound: "Автобус не найден",
    busWrongRoute: "Этот автобус не относится к выбранному маршруту",
  },

  report: {
    invalidLevel: "Выберите уровень загруженности: низкая, средняя или высокая",
    deviceRequired: "Требуется идентификатор устройства",
    cooldown: "Повторно сообщить по этому маршруту можно через {seconds} с",
    thanksVerified: "Спасибо! Ваше сообщение подтверждено по GPS.",
    thanksUnverified:
      "Спасибо! Сообщение принято — без GPS оно учитывается с меньшим весом.",
    rateLimit: "Слишком много сообщений. Попробуйте чуть позже.",
  },

  intent: {
    confirmed: "Поездка учтена",
    cancelled: "Поездка отменена",
    invalidLegs: "Неверные этапы маршрута",
  },

  alert: {
    notFound: "Оповещение не найдено",
    alreadyResolved: "Это оповещение уже закрыто",
    invalidAction: "Действие: acknowledge, dispatch или resolve",
    dispatched: {
      one: "Выделен {count} резервный автобус",
      few: "Выделено {count} резервных автобуса",
      many: "Выделено {count} резервных автобусов",
      other: "Выделено резервных автобусов: {count}",
    },
    note: {
      auto_crowd: "Создано автоматически (краудсорсинг)",
      auto_demand: "Проактивный прогноз спроса",
      command: "Команда: {title}",
    },
  },

  dispatch: {
    textTooLong: "Текст команды слишком длинный (макс. {max} символов)",
    unknownType: "Неизвестный тип команды",
    emptyText: "Текст команды пуст",
    sent: "Команда отправлена",
  },

  ai: {
    messagesRequired: "Сообщение пустое — напишите вопрос",
    rateLimit: "Достигнут лимит запросов к ИИ. Повторите через минуту.",
  },

  demo: { invalidLevel: "Неверный уровень (low | mid | high)" },

  reason: {
    reserves_on_line: "На линии уже резервных автобусов: {count}",
    crowd_live:
      "Краудсорсинг: индекс загруженности {score} (сообщений: {total}, подтверждено по GPS: {verified}) → расчётная заполненность {loadPct}%",
    forecast_next:
      "Прогноз на {hour}:00: «{levelLabel}» (заполненность {loadPct}%, достоверность {confidencePct}%)",
    demand_intents:
      "Спрос (A): «Еду» нажали {intents} раз → при доле приложения {appSharePct}% это ~{pax} пассажиров",
    live_riders:
      "Живая геолокация (B): сейчас в автобусах маршрута ~{riders} пассажиров",
    hot_segments: "Самый загруженный участок: {segments}",
    alert_min_one:
      "Активное оповещение «Высокая загруженность» — минимум 1 резервный автобус",
    limit_max:
      "Ограничение: не более {max} резервных автобусов на одно оповещение",
  },

  summary: {
    crowd:
      "Маршрут №{number}: за последние {windowMin} мин сообщений — {total}, общая загруженность «{levelLabel}» (тренд: {trendLabel}).",
    noReports: "Маршрут №{number}: за последние минуты сообщений нет.",
    load: "Расчётная заполненность: {loadPct}%.",
    hot: "Самый загруженный участок: {segment}.",
    forecast: "Прогноз на {hour}:00: «{levelLabel}».",
    demand: "Поездку в ближайшие 30 минут подтвердили пассажиров: {count}.",
    recommend:
      "Рекомендация: резервных автобусов — {count} (интервал {before} → {after} мин).",
    noNeed: "Дополнительные автобусы сейчас не нужны.",
  },

  // Оператор: прогноз на 1–2 часа (PredictionService, без Gemini)
  predict: {
    reason: {
      ongoing:
        "Сейчас ~{nowPct}% заполненности; в следующий час ожидается ~{nextPct}%.",
      forecast:
        "Исторический профиль + текущая ситуация: ожидается ~{loadPct}% заполненности (достоверность {confidencePct}%).",
      weather: "Погода ({condition}) увеличивает пассажиропоток.",
      traffic: "Плотные пробки сокращают число рейсов.",
    },
    realloc: {
      donor:
        "На маршруте №{from} заполненность не превысит {fromLoad}% — перевести 1 автобус на №{to} ({toLoad}%).",
      depot: {
        one: "{count} резервный автобус из парка на №{to} ({toLoad}%).",
        few: "{count} резервных автобуса из парка на №{to} ({toLoad}%).",
        many: "{count} резервных автобусов из парка на №{to} ({toLoad}%).",
        other: "{count} резервных автобуса из парка на №{to} ({toLoad}%).",
      },
    },
    summary: {
      ongoing: {
        one: "Высокая загрузка сохраняется на маршруте {list}.",
        few: "Высокая загрузка сохраняется на маршрутах {list}.",
        many: "Высокая загрузка сохраняется на маршрутах {list}.",
        other: "Высокая загрузка сохраняется на маршрутах {list}.",
      },
      spikes: {
        one: "В ближайшие 2 часа ожидается всплеск загрузки на {count} маршруте: {list}.",
        few: "В ближайшие 2 часа ожидается всплеск загрузки на {count} маршрутах: {list}.",
        many: "В ближайшие 2 часа ожидается всплеск загрузки на {count} маршрутах: {list}.",
        other:
          "В ближайшие 2 часа ожидается всплеск загрузки на {count} маршрутах: {list}.",
      },
      calm: "Резкого роста загрузки в ближайшие 2 часа не ожидается.",
      weather: "Погода: {condition}, {temp}°C.",
      traffic: "Пробки: {level}.",
    },
    weather: {
      clear: "ясно",
      cloudy: "облачно",
      fog: "туман",
      drizzle: "морось",
      rain: "дождь",
      snow: "снег",
      storm: "гроза",
      unknown: "нет данных",
    },
    traffic: { light: "слабые", moderate: "средние", heavy: "сильные" },
  },
  chat: {
    help: "Я помогу с маршрутами и загруженностью. Например: «Как доехать от Сахил до Короглу?», «Автобус 5 переполнен?», «Какой автобус самый свободный?»",
    routeNotFound: "Маршрут №{number} не найден",
    stopNotOnRoute: "Остановки «{stop}» на этом маршруте нет",
    endpointsNotFound: "Не найдена начальная или конечная остановка",
    noTrip: "Подходящий маршрут между этими остановками не найден.",
    tripBest:
      "{from} → {to}: лучший вариант {summary}, ~{min} мин (загруженность: {crowd}). Шаги: {steps}.",
    stepWalk: "пешком {meters} м",
    stepBus:
      "автобус №{number} {from} → {to} (ожидание {wait} мин, остановок: {stops}, загруженность: {crowd})",
    walkOnly: "Пешком",
    leastCrowded:
      "Сейчас свободнее всего маршрут №{number} ({name}) — «{crowd}».",
    notEnoughData:
      "Пока мало сообщений — помогите, сообщив о загруженности своего автобуса.",
    routeStatus:
      "№{number} ({name}): загруженность «{crowd}», автобусов на линии: {buses}, интервал ~{headway} мин.",
  },

  auth: {
    fillRequired: "Заполните все обязательные поля",
    passwordMin: "Пароль должен содержать не менее 8 символов",
    emailTaken: "Этот e-mail уже зарегистрирован",
    emailSendFailed: "Не удалось отправить письмо. Попробуйте снова",
    emailSendFailedShort: "Не удалось отправить письмо",
    codeSent: "Код подтверждения отправлен на ваш e-mail",
    emailCodeRequired: "Требуются e-mail и код подтверждения",
    registered: "Регистрация успешно завершена",
    emailRequired: "Требуется e-mail",
    noPending: "Ожидающее подтверждение не найдено. Начните заново",
    codeResent: "Новый код подтверждения отправлен",
    emailPasswordRequired: "Требуются e-mail и пароль",
    invalidCredentials: "Неверный e-mail или пароль",
    accountInactive: "Ваша учётная запись не активна",
    loginSuccess: "Вы успешно вошли",
    logoutSuccess: "Вы вышли из аккаунта",
    passwordsRequired: "Требуются текущий и новый пароли",
    newPasswordMin: "Новый пароль должен содержать не менее 8 символов",
    currentPasswordWrong: "Текущий пароль неверен",
    passwordChanged: "Пароль изменён",
    resetIfExists: "Если такой e-mail существует, код восстановления отправлен",
    resetSent: "Код восстановления отправлен на ваш e-mail",
    userNotFound: "Пользователь не найден",
    otpVerified: "Код подтверждён",
    newPasswordRequired: "Требуется новый пароль",
    passwordReset: "Пароль сброшен",
    profileUpdated: "Профиль обновлён",
    avatarRequired: "Требуется файл аватара",
    avatarUpdated: "Аватар обновлён",
    authRequired: "Требуется вход в систему",
    accountNotFoundInactive: "Учётная запись не найдена или неактивна",
    sessionExpiredRelogin: "Сессия истекла, войдите снова",
    sessionExpired: "Сессия истекла",
    invalidToken: "Недействительный токен",
    refreshRequired: "Требуется токен обновления",
    accountNotFound: "Учётная запись не найдена",
    invalidRefresh: "Недействительный токен обновления",
    resetTokenRequired: "Требуется токен сброса",
    resetTokenInvalidExpired: "Токен сброса недействителен или истёк",
    resetTokenInvalid: "Недействительный токен сброса",
    forbidden: "У вас нет прав для этого действия",
    otp: {
      notFound: "Код не найден или истёк",
      tooManyAttempts: "Слишком много неверных попыток. Запросите новый код",
      invalid: "Неверный код",
      expired: "Срок действия кода истёк",
    },
  },
};
