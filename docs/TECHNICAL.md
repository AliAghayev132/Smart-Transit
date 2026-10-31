# Texniki izah sənədi

## 1. Məşğul olunan problem

Bakıda pik saatlarda (iş günləri təxminən 07:30–10:00 və 17:00–20:00) avtobuslar həddən artıq dolur. Sərnişin dayanacağa çatanda:

- avtobusun nə vaxt gələcəyini dəqiq bilmir;
- gələn avtobusun minmək mümkün olacaq qədər boş olub-olmadığını bilmir;
- alternativ xətt və ya köçürmə barədə real-vaxt məlumatı yoxdur.

Dispetçer tərəfində isə sıxlıq barədə canlı məlumat yoxdur. Ehtiyat avtobus çox vaxt şikayət gəldikdən sonra, gecikmə ilə xəttə çıxır. Turniket datası minik sayını göstərir, amma avtobusun içindəki faktiki sıxlığı və dayanacaqda gözləyənləri göstərmir.

**Həll:** sərnişinlərin özləri sıxlığı bildirir (crowdsourcing), sistem bu bildirişləri GPS ilə yoxlayıb xətt, avtobus və seqment üzrə sıxlıq hesablayır. Dispetçer canlı xəritə, avtomatik xəbərdarlıq və növbəti 1–2 saat üçün AI proqnozu alır.

## 2. Funksionallıq

| Modul | İmkanlar |
|---|---|
| **Sərnişin** | canlı avtobuslar və gəliş vaxtı; sıxlıq bildirişi Az / Orta / Yüksək (GPS ilə yoxlanılır); Haradan → Haraya planlayıcı (köçürmə ilə); «Gedirəm» (proaktiv tələb); anonim canlı lokasiya; chatbot |
| **Crowdsourcing analitikası** | zamanla sönən çəki ilə sıxlıq balı, GPS-təsdiqli bildirişlərə yüksək çəki, trend; göstərilən sıxlıq +20% ehtiyat payı ilə |
| **Anomaliya xəbərdarlığı** | xətt son 10 dəqiqədə ardıcıl «Yüksək» bildirilərsə → «Əlavə avtobus ehtiyatı ayrılmalıdır» (banner + səs + tövsiyə) |
| **Gemini proqnozu** | `GET /api/analytics/predict`: növbəti 1–2 saatda gözlənilən sıçrayışlar, avtobusların xətlər arası yerdəyişməsi, risklər; tarixçə + pik saatlar + hava + tıxac |
| **Dispetçer** | sıxlıq heatmap-i, xətt konteksti, ehtiyat avtobus formulu, bir kliklə təsdiq, əmr şablonları, jurnal, hesabatlar, qısa yollar |
| **Çoxdillilik** | interfeys, server mesajları və AI cavabları AZ / EN / RU |

### Anomaliya qaydası

Son 10 dəqiqədə xətt üzrə ən azı 3 unikal cihazdan «Yüksək» bildiriş gəlməli və bu bildirişlər ümumi bildirişlərin ən azı 60%-ni təşkil etməlidir. Saxta bildirişlərə qarşı:

- hər cihaz üçün cooldown (60 san);
- eyni şəbəkə mənbəyindən (IP-nin HMAC hash-i) ən çox 2 cihaz sayılır;
- GPS-lə avtobusa yaxınlığı təsdiqlənməyən bildirişin çəkisi azdır.

### Proqnoz modeli

1. **Statistik baza:** həftə günü × saat üzrə 14 günlük orta + Bakı pik profili (az data olduqda) + cari canlı sapma (saatlar keçdikcə sönür).
2. **Kontekst:** tarixi pik saatlar, hava (yağış və güclü külək avtobusa tələbi artırır), tıxac (real GPS sürəti və ya saat profili), park (avtobus və ehtiyat sayı, interval).
3. **Gemini** bu konteksti və baza modelinin nəticəsini alır, `responseSchema` ilə JSON qaytarır.
4. **Yoxlama:** naməlum xətlər atılır, rəqəmlər hədlərə salınır, donor xətdə minimum avtobus qalır. Gemini əlçatan olmasa baza modeli qaytarılır, operator paneli heç vaxt boş qalmır.

## 3. Seçilmiş texnologiyalar

| Texnologiya | Niyə |
|---|---|
| **MongoDB** | Bildirişlər, niyyətlər və snapshot-lar sxemi dəyişkən, yazma intensiv sənədlərdir. Hazır **geo indekslər** (`2dsphere`) yaxın bildirişləri və tələbi tapır, **TTL indekslər** köhnə datanı avtomatik silir (bildiriş 30 gün, snapshot 7 gün) |
| **Express 5 + Socket.IO** | Yüngül REST API və eyni prosesdə real-vaxt kanal: avtobus mövqeləri hər 2 saniyə, sıxlıq və xəbərdarlıqlar dərhal ötürülür. Operator hadisələri yalnız `operators` otağına gedir |
| **React 19 + Vite + RTK Query** | Sürətli SPA, keş və avtomatik yeniləmə; dil dəyişəndə yalnız lokallaşdırılmış sorğular yenilənir. Xəritə və diaqramlar ayrıca chunk-lardadır (əsas bundle ~127 KB) |
| **Node.js hər iki tərəfdə (MERN)** | Bir dil, ümumi alətlər (ESLint, Prettier), komanda üçün sürətli inkişaf |
| **CARTO basemaps** | Təmiz, oxunaqlı xəritə: işıqlı (Voyager) və qaranlıq (Dark Matter) üslub dispetçer panelinin temasına uyğun gəlir. Leaflet ilə işləyir, Google Maps açarı tələb etmir; açar olmasa da açıq plitələrə keçir |
| **Google Gemini** | Strukturlu JSON çıxışı (`responseSchema`), sürətli və ucuz Flash modelləri, Azərbaycan / rus / ingilis dillərində keyfiyyətli mətn. LLM rəqəmləri sıfırdan uydurmur: statistik modelin nəticəsini kontekstlə (hava, tıxac, pik) düzəldir və izah edir |
| **Open-Meteo** | Açarsız, pulsuz hava API-si; Bakı üçün saatlıq yağış ehtimalı |
| **i18next** | Rus dilinin cəm formaları (`_one/_few/_many`), interpolasiya; server tərəfində eyni açar sistemi |
| **node:test + Vitest** | Server testləri Node-un daxili test runner-i ilə (əlavə paket yoxdur), client testləri Vite ilə eyni konfiqurasiyada |

## 4. Layihənin strukturu

```
smart-transit/
├── package.json                 # kök skriptlər: install:all, dev, test, lint, build
├── docs/                        # SETUP, ARCHITECTURE, TECHNICAL, AI-DECLARATION, AI-STRATEGY,
│                                #   OPERATOR-UX, DESIGN-SYSTEM, AUDIT-REPORT, ci-workflow.yml
├── server/
│   ├── app.js                   # giriş nöqtəsi: env yoxlaması, servislər, listen, shutdown
│   ├── core/                    # createApp (Express + Socket.IO), envCheck
│   ├── config/                  # bütün env parametrləri (transit, gemini, weather, ai, …)
│   ├── constants/shared/        # enum-lar, real BakuBus xətləri (seedRoutes), əmr şablonları
│   ├── models/                  # Mongoose sxemləri (route, bus, densityReport, routeAlert, …)
│   ├── controllers/             # HTTP qatı
│   ├── routes/                  # /api/* marşrutları
│   ├── services/                # Fleet, Eta, Analytics, Forecast, Prediction, Gemini, Weather,
│   │                            #   Demand, Presence, Dispatch, Assistant, Planner, Socket, …
│   ├── middlewares/             # auth + rol, security (helmet, CORS, limitlər), sanitize, lang
│   ├── locales/                 # az.js, en.js, ru.js
│   ├── utils/                   # cavab formatı, xəta, i18n, geo yoxlama, crowdBoost, hashIp
│   ├── scripts/                 # seedTransit, resetDatabase
│   └── tests/                   # unit, integration, security + in-memory DB qatı (support/)
└── client-react/
    ├── vite.config.js           # alias-lar, chunk-lar, Vitest
    └── src/
        ├── components/
        │   ├── ui/              # Button, Card, Input, Modal, Badge, …
        │   ├── map/             # MapView (Google ⇄ Leaflet + CARTO), marker və heatmap modeli
        │   ├── transit/         # sərnişin: SearchBar, TripPlanner, DepartureCards, ReportCard, …
        │   ├── operator/        # AlertCard, PredictionCard, RecommendationPanel, DispatchModal, …
        │   └── chat/            # TransitChatbot
        ├── pages/               # public (Home, Login) və dashboard (Map, Routes, Alerts, Reports)
        ├── layouts/, routes/    # səhifə quruluşu və rol əsaslı marşrutlar
        ├── store/               # RTK Query API-ları, slice-lar, Socket / Theme / TransitLive kontekstləri
        ├── hooks/, services/    # qısa yollar, canlı lokasiya, yer axtarışı, geolokasiya
        ├── locales/{az,en,ru}/  # common, passenger, operator
        └── utils/               # format, toast, deviceId, …
```

## 5. API (əsas endpoint-lər)

| Metod | Yol | Giriş |
|---|---|---|
| GET | `/api/routes`, `/api/routes/buses`, `/api/routes/:id/stops/:stopId/eta` | public |
| POST | `/api/reports` | public (rate limit + cihaz cooldown) |
| GET | `/api/analytics/crowd` | public |
| GET | `/api/analytics/heat`, `/forecast`, `/forecast/:routeId`, `/timeseries` | operator |
| GET | `/api/analytics/predict` (`?refresh=1`) | operator, AI limiti |
| POST | `/api/plan`, `/api/intents` | public |
| GET / PATCH | `/api/alerts`, `/api/alerts/:id` | operator |
| GET / POST | `/api/dispatch/templates`, `/recommend/:routeId`, `/commands` | operator |
| GET / POST | `/api/ai/status`, `/api/ai/chat`, `/api/ai/summary/:routeId` | qarışıq |
| POST | `/api/routes/buses/:busId/location` (real GPS treker) | operator |

Cavab formatı: `{ success, message?, data? }`. Dil: `Accept-Language: az | en | ru` və ya `?lang=`.

## 6. Təhlükəsizlik və keyfiyyət

- JWT (access + refresh), rol yoxlaması (`operator`, `admin`), token versiyası ilə sessiyanın ləğvi.
- Prodakşnda zəif açar və standart parollarla server açılmır; demo alətləri bağlıdır.
- Helmet başlıqları, CORS siyahısı, JSON limiti 100 KB, NoSQL injection və prototip çirklənməsinə qarşı sanitizer.
- Ayrıca rate limit-lər: bildiriş, «Gedirəm», plan, AI, login.
- Gemini açarı yalnız serverdədir, sorğu başlığında göndərilir; modelə şəxsi məlumat getmir; model mətni UI-da adi mətn kimi göstərilir.
- Testlər: server 91 (unit, inteqrasiya, təhlükəsizlik), client 34; ESLint, tərcümə yoxlaması, production build. Ətraflı: [AUDIT-REPORT.md](AUDIT-REPORT.md).

## 7. Məlumat mənbələri və məhdudiyyətlər

- 13 xətt real BakuBus marşrutlarıdır (report.az siyahısı və airport.az-dakı H1 Aeroekspres). Dayanacaq koordinatları əsasən metro stansiyalarına bağlıdır, xətt həndəsəsi prospektlər üzrə təxminidir.
- Açıq GTFS / real GPS lenti olmadığı üçün avtobus hərəkəti simulyatorla göstərilir. Real treker `POST /api/routes/buses/:busId/location` ilə qoşulur və simulyatoru həmin avtobus üçün avtomatik söndürür.
- Tıxac göstəricisi GPS göndərən avtobus olmadıqda saat profilinə əsaslanan təxmindir.

## 8. Gələcək inkişaf imkanları

| İstiqamət | Təsvir |
|---|---|
| **IoT sensorları** | Avtobus qapılarında sərnişin sayğacları (infraqırmızı / kamera əsaslı), çəki sensorları və Wi-Fi / BLE probları → crowdsourcing-i real ölçü ilə tamamlamaq; MQTT → server adapteri |
| **Real GPS və GTFS** | AYNA / BakuBus GPS lentinə qoşulma, GTFS / GTFS-Realtime idxalı, OSM-dən dəqiq yol həndəsəsi (OSRM ilə yola bağlama) |
| **Mobil tətbiq (React Native)** | Eyni API və Socket.IO ilə; push bildirişlər («avtobusunuz 3 dəqiqəyə gəlir, orta sıxlıq»), fon rejimində «Gedirəm» |
| **ML proqnozu** | Data yığıldıqca LightGBM / XGBoost (kvantil reqressiya), sonra Temporal Fusion Transformer və ya xətlər qrafı üzərində GNN; Gemini izah və ssenari qatı kimi qalır |
| **Avtomatik dispetçer** | Proqnoz əsasında qrafikin optimallaşdırılması (OR-Tools), sürücü növbələri ilə inteqrasiya |
| **BakıKart inteqrasiyası** | Turniket datası ilə minik sayının təsdiqi və gediş-gəliş matrisi |
| **Əlçatanlıq** | Səsli bildirişlər, ekran oxuyucu ilə tam yoxlama (axe), yüksək kontrast tema |
| **Açıq data** | Anonimləşdirilmiş sıxlıq statistikasının bələdiyyə və tədqiqatçılar üçün API-si |
| **Docker / CI-CD** | `docker compose` ilə Mongo + server + client, avtomatik deploy |
