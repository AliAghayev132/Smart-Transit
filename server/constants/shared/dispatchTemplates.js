/**
 * Dispetçer əmri şablonları (AZ / EN / RU). {route}, {count}, {stop}, {from}, {minutes}, {sourceRoute}
 * yer tutucuları göndərilmədən əvvəl doldurulur (DispatchService.fillTemplate).
 * API dilə görə düz obyekt qaytarır: { type, title, text, fields, createsReserve } (DispatchService.templates(lang)).
 */
const dispatchTemplates = [
  {
    type: "RESERVE_RELEASE",
    title: {
      az: "Ehtiyat avtobus buraxılışı",
      en: "Release reserve buses",
      ru: "Выпуск резервных автобусов",
    },
    text: {
      az: "№{route} xəttinə {count} ehtiyat avtobus buraxılsın. Xəttə çıxış: {stop}. Səbəb: yüksək sıxlıq.",
      en: "Release {count} reserve bus(es) onto route {route}. Join the route at: {stop}. Reason: high crowding.",
      ru: "Выпустить на маршрут №{route} резервные автобусы: {count}. Выход на линию: {stop}. Причина: высокая загруженность.",
    },
    fields: ["count", "stop"],
    createsReserve: true,
  },
  {
    type: "HEADWAY_REDUCE",
    title: {
      az: "İntervalın qısaldılması",
      en: "Shorten headway",
      ru: "Сокращение интервала",
    },
    text: {
      az: "№{route} xəttində növbəti {minutes} dəqiqə ərzində hərəkət intervalı qısaldılsın; dayanacaqlarda gözləmə minimuma endirilsin.",
      en: "On route {route}, shorten the headway for the next {minutes} minutes and keep dwell time at stops to a minimum.",
      ru: "На маршруте №{route} в ближайшие {minutes} мин сократить интервал движения; стоянку на остановках свести к минимуму.",
    },
    fields: ["minutes"],
  },
  {
    type: "SHORT_TURN",
    title: {
      az: "Qısa dövrə (short-turn)",
      en: "Short turn",
      ru: "Укороченный рейс (short-turn)",
    },
    text: {
      az: "№{route} xəttinin növbəti avtobusu {stop} dayanacağında dövrə vurub sıxlıq olan istiqamətə qaytarılsın.",
      en: "The next bus on route {route} should turn back at {stop} and return toward the crowded direction.",
      ru: "Следующий автобус маршрута №{route} развернуть на остановке «{stop}» и направить в загруженном направлении.",
    },
    fields: ["stop"],
  },
  {
    type: "EXPRESS_RUN",
    title: {
      az: "Ekspress reys",
      en: "Express run",
      ru: "Экспресс-рейс",
    },
    text: {
      az: "№{route} xəttində {stop} dayanacağından ekspress reys təşkil edilsin (aralıq dayanacaqlarda yalnız düşmə).",
      en: "Run an express trip on route {route} from {stop} (drop-off only at intermediate stops).",
      ru: "Организовать экспресс-рейс по маршруту №{route} от остановки «{stop}» (на промежуточных остановках только высадка).",
    },
    fields: ["stop"],
  },
  {
    type: "REROUTE_FROM_LINE",
    title: {
      az: "Başqa xəttdən yönləndirmə",
      en: "Borrow buses from another route",
      ru: "Перевод автобусов с другого маршрута",
    },
    text: {
      az: "№{sourceRoute} xəttindən {count} avtobus müvəqqəti olaraq №{route} xəttinə yönləndirilsin.",
      en: "Temporarily move {count} bus(es) from route {sourceRoute} to route {route}.",
      ru: "Временно перевести автобусы с маршрута №{sourceRoute} на маршрут №{route}: {count}.",
    },
    fields: ["sourceRoute", "count"],
  },
  {
    type: "CUSTOM",
    title: {
      az: "Sərbəst əmr",
      en: "Custom command",
      ru: "Произвольная команда",
    },
    text: { az: "", en: "", ru: "" },
    fields: [],
  },
];

export { dispatchTemplates };
