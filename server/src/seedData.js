/**
 * Demo məlumatları: Bakının real ərazilərinə yaxın, sadələşdirilmiş xətlər.
 * Koordinatlar təqribidir; xətt həndəsəsi dayanacaqlar arası düz xətlərdir.
 * Real marşrut məlumatı (GTFS və s.) olduqda "path" sahəsinə tam həndəsə yazıla bilər.
 */
module.exports = [
  {
    number: '1',
    name: 'Sahil – Koroğlu',
    color: '#2563eb',
    stops: [
      { name: 'Sahil m.', lat: 40.3717, lng: 49.8443 },
      { name: '28 May m.', lat: 40.3796, lng: 49.8487 },
      { name: 'Gənclik m.', lat: 40.4004, lng: 49.8513 },
      { name: 'Nəriman Nərimanov m.', lat: 40.4027, lng: 49.8706 },
      { name: 'Ulduz m.', lat: 40.4146, lng: 49.8794 },
      { name: 'Koroğlu m.', lat: 40.4209, lng: 49.9183 },
    ],
    buses: 4,
  },
  {
    number: '5',
    name: 'İçərişəhər – Memar Əcəmi',
    color: '#db2777',
    stops: [
      { name: 'İçərişəhər m.', lat: 40.3659, lng: 49.8317 },
      { name: 'Elmlər Akademiyası m.', lat: 40.375, lng: 49.8146 },
      { name: 'İnşaatçılar m.', lat: 40.3911, lng: 49.803 },
      { name: '20 Yanvar m.', lat: 40.4045, lng: 49.8085 },
      { name: 'Memar Əcəmi m.', lat: 40.411, lng: 49.815 },
    ],
    buses: 3,
  },
  {
    number: '13',
    name: 'Nərimanov – Əhmədli',
    color: '#ea580c',
    stops: [
      { name: 'Nəriman Nərimanov m.', lat: 40.4027, lng: 49.8706 },
      { name: 'Xətai m.', lat: 40.383, lng: 49.872 },
      { name: 'Ağ şəhər', lat: 40.3745, lng: 49.8784 },
      { name: 'Xalqlar Dostluğu m.', lat: 40.3976, lng: 49.952 },
      { name: 'Əhmədli m.', lat: 40.385, lng: 49.9535 },
    ],
    buses: 3,
  },
  {
    number: '88',
    name: '28 May – Dənizkənarı Bulvar – Ağ şəhər',
    color: '#059669',
    stops: [
      { name: '28 May m.', lat: 40.3796, lng: 49.8487 },
      { name: 'Fəvvarələr meydanı', lat: 40.3699, lng: 49.8375 },
      { name: 'Dənizkənarı Bulvar', lat: 40.3681, lng: 49.8448 },
      { name: 'Bayıl yolu / Sahil', lat: 40.3655, lng: 49.8569 },
      { name: 'Ağ şəhər', lat: 40.3745, lng: 49.8784 },
    ],
    buses: 3,
  },
];
