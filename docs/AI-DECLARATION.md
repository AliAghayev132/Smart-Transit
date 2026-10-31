# AI İstifadəsi Haqqında Bəyannamə (AI Declaration)

Bu sənəd **Smart Transit Crowdsourcing & Analytics Engine** layihəsinin hazırlanması prosesində süni intellekt (AI) alətlərindən necə və hansı məqsədlərlə istifadə olunduğunu şəffaf şəkildə əks etdirir.

---

## 🛠️ İstifadə Olunan AI Alətləri və Rolları

1. **Gemini (Google):**
   - **Rolu:** Promptların tərtib edilməsi, strukturlaşdırılması və analitika modulu üçün zəruri olan Google Gemini API açarının təmin edilməsi.
   - **API Key:** Layihənin gələcək proqnozlaşdırma (predictive analytics) funksiyası üçün verilən açar (`AQ.Ab8R…68Ew`) inteqrasiya edilmişdir. Açar yalnız serverdə, `server/.env` faylında (`GEMINI_API_KEY`) saxlanılır; repoya və müştəri tətbiqinə düşmür.
   - **Tətbiqdə istifadəsi:** `gemini-3.5-flash` modeli operator panelində növbəti 1–2 saat üçün sıxlıq sıçrayışlarını və avtobusların yerdəyişməsini proqnozlaşdırır (`GET /api/analytics/predict`).

2. **Claude (Anthropic):**
   - **Rolu:** Kod bazasının təhlili, arxitekturanın qurulması, backend (Express.js + MongoDB), frontend (React, Carto Basemap, i18n, Dark/Light Mode) komponentlərinin yazılması və texniki sənədləşdirmənin formalaşdırılması.
   - **Model:** Claude Opus 5.5, agent rejimində (faylları oxuyub-yazan, testləri işə salan, brauzerdə UI-ı yoxlayan).

---

## 📥 İstifadəçi Inputları (Promptlar) və 📤 Claude Outputları (Nəticələr)

### 1. Problem Konteksti və İlkin Tələblər
* **İstifadəçi Inputu (Prompt):**
  > Bakı şəhərində pik saatlarda avtobus marşrutlarında həddindən artıq sıxlıq yaşanır, gözləmə müddətləri qeyri-müəyyənləşir... Sərnişin modulu (real-time yerləşmə, gəliş vaxtı, `low/mid/high` sıxlıq reportu), Operator modulu (crowdsourcing data əsasında sıxlıq xəritəsi, 10 dəqiqə ərzində "Yüksək" sıxlıq olduqda avtomatik "Əlavə avtobus ehtiyatı ayrılmalıdır" bildirişi). MERN stack istifadə et (`react`, `express.js`, `mongodb`). Map inteqrasiyası (`@vis.gl/react-google-maps` xətası və Carto fallback), Sərnişin sıxlığının təyini (normaldan +20% daha sıx göstərilməsi), Places Autocomplete, Six-O dizayn prinsipləri, i18n (AZ, EN, RU), Dark/Light Mode, Carto raster/vector tile URL-ləri.
* **Claude Outputu:**
  - Map engine üçün Carto tile URL dəstəyi ilə alternativ fallback mexanizminin qurulması (Google Maps ⇄ Leaflet + CARTO / OSM).
  - Sərnişin sıxlığı üçün `+20%` buffer hesablanması məntiqinin backend və frontend-ə tətbiqi (`CROWD_DISPLAY_BOOST_PCT`).
  - Operator paneli üçün anomaliya xəbərdarlığı (`High density > 10 mins`) sisteminin kodlaşdırılması.
  - «Six-O» dizayn sistemi, avtobus ikonları, AZ / EN / RU tərcümələri və işıqlı / qaranlıq tema.

### 2. Hackathon Judge Audit, Fix & Test Agent Tələbi
* **İstifadəçi Inputu (Prompt):**
  > Act as a strict, expert Hackathon Judge and Senior Software Engineer... Phase 1: Judge Audit & Report, Phase 2: Autonomous Fixes, Phase 3: Testing & Security Assurance.
* **Claude Outputu:**
  - Kod bazasının tənqidi auditi və kritik xətaların aşkarlanması ([AUDIT-REPORT.md](AUDIT-REPORT.md)): prodakşnda bilinən parollar, açıq demo endpoint-ləri, saxta cihazlarla anomaliya yaratmaq imkanı («Sybil» hücumu), testlərin olmaması.
  - Xətaların birbaşa aradan qaldırılması və refaktorinq (`core/createApp.js`, sanitizer, rate limit-lər, IP-hash qorunması).
  - Unit, inteqrasiya və təhlükəsizlik testləri (`node:test`, Vitest + Testing Library) və CI workflow.
  - Real BakuBus marşrut datası (13 xətt, açıq mənbələrdən: report.az, airport.az).

### 3. Əlavə Təqdimat Sənədləri və Gemini AI Analitika Tələbi
* **İstifadəçi Inputu (Prompt):**
  > Təhvil veriləcək hissələr: Layihənin lokal mühitdə başladılması addımları, qısa sistem arxitekturasının təsviri, AI bəyannaməsi, texniki izah sənədi. Operatorlar dashboardunda anklitika hissəsi üçün future predictionlar edən funksionallıq yaz AI ilə Gemini API key ilə olacaq (`AQ.Ab8R…68Ew`).
* **Claude Outputu:**
  - `/api/analytics/predict` endpoint-inin və Gemini API xidmətinin inteqrasiyası: tarixi crowdsourcing datası, pik saatlar, hava (Open-Meteo) və tıxac göstəriciləri əsasında proqnoz; Gemini əlçatan olmadıqda deterministik baza modeli; model cavabının server tərəfində yoxlanılması.
  - Operator panelində «Gemini proqnozu» kartı.
  - Lokal quraşdırma təlimatı ([SETUP.md](SETUP.md)), sistem arxitekturası ([ARCHITECTURE.md](ARCHITECTURE.md)) və texniki izah sənədinin ([TECHNICAL.md](TECHNICAL.md)) tam markdown formatında hazırlanması.

---

## 🎯 Nəticə
Layihənin uğurla hazırlanmasında **Gemini** promptların optimallaşdırılmasında və AI xidmətinin təminatında, **Claude** isə tətbiqin proqram təminatı arxitekturasının, kodlarının və sənədləşdirməsinin tam avtomatlaşdırılmış şəkildə yazılmasında səmərəli şəkildə istifadə edilmişdir.
