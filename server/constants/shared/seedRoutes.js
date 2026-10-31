/**
 * Bakı avtobus xətləri — real xətt nömrələri və istiqamətlər.
 *
 * Mənbələr:
 *  - BakuBus ASC-nin ilk 14 xətti (report.az, «Initial route lines and tariffs of BakuBus OJSC buses revealed»).
 *    Kodda 7 və 9 nömrəli xətlər yoxdur: onların marşrut təsviri birmənalı deyil.
 *  - H1 Aeroekspres: 28 May → Heydər Əliyev Beynəlxalq Aeroportu (airport.az).
 *  - Dayanacaq koordinatları: metro stansiyaları və əsas meydanlar (OpenStreetMap ilə uyğun, ±50 m).
 * Həndəsə: dayanacaqlar + əsas prospektlər üzrə ara nöqtələr (`via`). Bu, yolu təqribi izləyir.
 * Tam həndəsə üçün OSM / GTFS-dən `path` (lat, lng massivi) yazıla bilər — GeoService onu birbaşa istifadə edir.
 *
 * Qeyd: xətlərin hazırkı (2026) marşrutları dəyişmiş ola bilər. Real vaxt datası üçün AYNA / BakuBus GTFS lazımdır.
 */

// ============ DAYANACAQLAR (metro stansiyaları və əsas nöqtələr) ============
const S = {
  koroglu: { name: "Koroğlu m.", lat: 40.4209, lng: 49.9183 },
  ulduz: { name: "Ulduz m.", lat: 40.4146, lng: 49.8794 },
  narimanov: { name: "Nəriman Nərimanov m.", lat: 40.4027, lng: 49.8706 },
  genclik: { name: "Gənclik m.", lat: 40.4004, lng: 49.8513 },
  may28: { name: "28 May m.", lat: 40.3796, lng: 49.8487 },
  sahil: { name: "Sahil m.", lat: 40.3717, lng: 49.8443 },
  icherisheher: { name: "İçərişəhər m.", lat: 40.3659, lng: 49.8317 },
  nizami: { name: "Nizami m.", lat: 40.3793, lng: 49.8302 },
  elmler: { name: "Elmlər Akademiyası m.", lat: 40.375, lng: 49.8146 },
  insaatcilar: { name: "İnşaatçılar m.", lat: 40.3911, lng: 49.803 },
  yanvar20: { name: "20 Yanvar m.", lat: 40.4045, lng: 49.8085 },
  memarAcemi: { name: "Memar Əcəmi m.", lat: 40.4117, lng: 49.8075 },
  nasimi: { name: "Nəsimi m.", lat: 40.4245, lng: 49.8251 },
  azadliq: { name: "Azadlıq prospekti m.", lat: 40.4256, lng: 49.8425 },
  darnagul: { name: "Dərnəgül m.", lat: 40.4253, lng: 49.8606 },
  xatai: { name: "Xətai m.", lat: 40.3829, lng: 49.8717 },
  hacCenter: { name: "Heydər Əliyev Mərkəzi", lat: 40.3958, lng: 49.8676 },
  azneft: { name: "Azneft dairəsi", lat: 40.3625, lng: 49.8372 },
  bayil: { name: "Bayıl", lat: 40.3512, lng: 49.8328 },
  sahe20: { name: "20-ci sahə", lat: 40.3437, lng: 49.8186 },
  qaraQarayev: { name: "Qara Qarayev m.", lat: 40.4176, lng: 49.9339 },
  airport: { name: "Heydər Əliyev Aeroportu", lat: 40.4675, lng: 50.0467 },
};

/** Ara nöqtələr: prospekt boyunca (yolu təqribi izləmək üçün) */
const V = {
  // Atatürk / Təbriz: Gənclik ↔ Nərimanov
  genclikNarimanov: [[40.4013, 49.8608]],
  // Heydər Əliyev prospekti: Nərimanov ↔ Ulduz ↔ Koroğlu
  narimanovUlduz: [[40.4088, 49.8758]],
  ulduzKoroglu: [
    [40.4168, 49.8925],
    [40.419, 49.906],
  ],
  // Azadlıq prospekti: Gənclik ↔ Azadlıq
  genclikAzadliq: [
    [40.4092, 49.8474],
    [40.4178, 49.8446],
  ],
  // Bakıxanov / Füzuli: Gənclik ↔ 28 May
  genclik28May: [[40.3898, 49.8506]],
  // Neftçilər prospekti (Bulvar): Sahil ↔ Azneft
  sahilAzneft: [[40.3668, 49.8404]],
  // Bayıl yolu
  azneftBayil: [[40.3572, 49.8352]],
  bayilSahe20: [[40.3478, 49.8262]],
  // Nizami ↔ Elmlər (Rəşid Behbudov / Hüseyn Cavid)
  nizamiElmler: [[40.3778, 49.8222]],
  // Tbilisi prospekti: Elmlər ↔ İnşaatçılar ↔ 20 Yanvar
  elmlerInsaat: [[40.383, 49.8085]],
  // Nəsimi ↔ Azadlıq (Ziya Bünyadov / Azadlıq)
  nasimiAzadliq: [[40.4268, 49.8338]],
  // 20 Yanvar ↔ Gənclik (Moskva prospekti — 8 Noyabr)
  yanvarGenclik: [
    [40.4037, 49.8218],
    [40.4018, 49.8375],
  ],
  // 20 Yanvar ↔ Nizami (Rəsul Rza / Səməd Vurğun)
  yanvarNizami: [
    [40.3962, 49.8172],
    [40.3862, 49.8254],
  ],
  // 28 May ↔ Xətai (Xətai prospekti)
  may28Xatai: [[40.3812, 49.8608]],
  // Nərimanov ↔ Heydər Əliyev Mərkəzi ↔ Xətai (Təbriz / Babək)
  narimanovHac: [[40.3992, 49.8697]],
  hacXatai: [[40.3893, 49.8702]],
  // Azadlıq ↔ Dərnəgül
  azadliqDarnagul: [[40.4262, 49.8516]],
  // Aeroport yolu (Heydər Əliyev prospekti şərqə)
  qaraQarayevAirport: [
    [40.4235, 49.9605],
    [40.4392, 49.9905],
    [40.4552, 50.0215],
  ],
};

const rev = (points) => [...points].reverse();

/** Dayanacaqlar + ara nöqtələr (nöqtə massivləri) → həndəsə (path) */
const line = (number, name, color, buses, parts) => {
  const stops = [];
  const path = [];
  for (const p of parts) {
    if (Array.isArray(p)) {
      path.push(...p.map(([lat, lng]) => [lat, lng]));
    } else {
      stops.push({ ...p });
      path.push([p.lat, p.lng]);
    }
  }
  return { number, name, color, buses, stops, path };
};

const seedRoutes = [
  line("1", "Koroğlu – 28 May", "#2563eb", 4, [
    S.koroglu,
    rev(V.ulduzKoroglu),
    S.ulduz,
    V.narimanovUlduz,
    S.narimanov,
    V.genclikNarimanov,
    S.genclik,
    V.genclik28May,
    S.may28,
  ]),
  line("2", "20 Yanvar – Azadlıq prospekti", "#7c3aed", 3, [
    S.yanvar20,
    S.memarAcemi,
    S.nasimi,
    V.nasimiAzadliq,
    S.azadliq,
  ]),
  line("3", "Azadlıq prospekti – Elmlər Akademiyası", "#0891b2", 4, [
    S.azadliq,
    V.nasimiAzadliq,
    S.nasimi,
    S.memarAcemi,
    S.yanvar20,
    S.insaatcilar,
    V.elmlerInsaat,
    S.elmler,
  ]),
  line("4", "Nəriman Nərimanov – Xətai", "#ca8a04", 3, [
    S.narimanov,
    V.narimanovHac,
    S.hacCenter,
    V.hacXatai,
    S.xatai,
  ]),
  line("5", "Nəriman Nərimanov – 20-ci sahə", "#db2777", 4, [
    S.narimanov,
    V.genclikNarimanov,
    S.genclik,
    V.genclik28May,
    S.may28,
    S.sahil,
    V.sahilAzneft,
    S.azneft,
    V.azneftBayil,
    S.bayil,
    V.bayilSahe20,
    S.sahe20,
  ]),
  line("6", "Azadlıq prospekti – 20-ci sahə", "#16a34a", 4, [
    S.azadliq,
    rev(V.genclikAzadliq),
    S.genclik,
    V.genclik28May,
    S.may28,
    S.sahil,
    V.sahilAzneft,
    S.azneft,
    V.azneftBayil,
    S.bayil,
    V.bayilSahe20,
    S.sahe20,
  ]),
  line("8", "Azadlıq prospekti – 28 May", "#9333ea", 3, [
    S.azadliq,
    rev(V.genclikAzadliq),
    S.genclik,
    V.genclik28May,
    S.may28,
  ]),
  line("10", "Nəriman Nərimanov – Azneft dairəsi", "#0d9488", 3, [
    S.narimanov,
    V.genclikNarimanov,
    S.genclik,
    V.genclik28May,
    S.may28,
    S.sahil,
    V.sahilAzneft,
    S.azneft,
  ]),
  line("11", "Nəriman Nərimanov – Elmlər Akademiyası", "#e11d48", 3, [
    S.narimanov,
    V.genclikNarimanov,
    S.genclik,
    V.genclik28May,
    S.may28,
    S.nizami,
    V.nizamiElmler,
    S.elmler,
  ]),
  line("12", "20 Yanvar – 20-ci sahə", "#ea580c", 4, [
    S.yanvar20,
    S.insaatcilar,
    V.elmlerInsaat,
    S.elmler,
    S.icherisheher,
    S.azneft,
    V.azneftBayil,
    S.bayil,
    V.bayilSahe20,
    S.sahe20,
  ]),
  line("13", "20 Yanvar – Koroğlu", "#4f46e5", 4, [
    S.yanvar20,
    V.yanvarGenclik,
    S.genclik,
    V.genclikNarimanov,
    S.narimanov,
    V.narimanovUlduz,
    S.ulduz,
    V.ulduzKoroglu,
    S.koroglu,
  ]),
  line("14", "20 Yanvar – Xətai", "#059669", 3, [
    S.yanvar20,
    V.yanvarNizami,
    S.nizami,
    S.may28,
    V.may28Xatai,
    S.xatai,
  ]),
  line("H1", "Aeroekspres: 28 May – Aeroport", "#475569", 3, [
    S.may28,
    rev(V.genclik28May),
    S.genclik,
    V.genclikNarimanov,
    S.narimanov,
    V.narimanovUlduz,
    S.ulduz,
    V.ulduzKoroglu,
    S.koroglu,
    S.qaraQarayev,
    V.qaraQarayevAirport,
    S.airport,
  ]),
];

export { seedRoutes };
