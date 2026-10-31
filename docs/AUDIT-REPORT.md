# Münsif auditi — Smart Transit Bakı

Tarix: 31.10.2026. Əhatə: `server/` (Express + Mongoose + Socket.IO), `client-react/` (React 19 + RTK Query), sənədlər.
Metod: kodun oxunması, API-yə real sorğular (in-memory DB ilə), Playwright ilə UI yoxlaması.

## Qiymətləndirmə (düzəlişlərdən əvvəl → sonra)

| Meyar | Əvvəl | Sonra | Şərh |
|---|---|---|---|
| İnnovasiya | 8/10 | 8/10 | Crowdsourcing + proaktiv tələb (A) + canlı lokasiya (B) + deterministik dispetçer tövsiyəsi və LLM izahı. Güclü konsepsiya |
| Funksionallıq | 7/10 | 8/10 | Hər iki modul işləyir. Data 4 süni xətdən ibarət idi → 13 real BakuBus xətti |
| Kod keyfiyyəti | 6/10 | 8/10 | Struktur təmizdir, amma **heç bir test yox idi** və `app.js` test oluna bilmirdi |
| Təhlükəsizlik | 5/10 | 8/10 | Auth qoruması düzgündür. Prodakşn defoltları və crowdsourcing manipulyasiyası açıq idi |
| Performans | 7/10 | 8/10 | Əsas bundle 595 KB idi (500 KB limitindən böyük) |
| UX | 8/10 | 8/10 | Six-O dizaynı, 3 dil, tema. Əlçatanlıq yaxşıdır |

---

## 🔴 Kritik problemlər / blokerlər

| # | Problem | Yer | Risk | Status |
|---|---|---|---|---|
| C1 | **Prodakşnda bilinən parollu admin/operator yaradılır**, parol loqa yazılır (`Admin123!`, `Operator123!`) | `BootstrapService`, `config.js` | Paneli hər kəs ələ keçirə bilər | ✅ Prodakşnda env məcburidir, parol loqa yazılmır |
| C2 | **Demo endpoint-ləri prodakşnda defolt olaraq açıqdır** (`DEMO_ENABLED !== "false"`) | `config.js` | Saxta bildiriş və anomaliya yaradıla bilər | ✅ Defolt: yalnız development |
| C3 | **Anomaliya qaydası «Sybil» hücumuna açıqdır**: `deviceId` müştəri tərəfindən göndərilir, bir IP-dən 3 fərqli `deviceId` ilə 10 dəqiqədə saxta «Əlavə avtobus» xəbərdarlığı yaranır və ehtiyat avtobus tövsiyə olunur | `AnalyticsService.evaluateAnomaly` | Real resurs israfı | ✅ IP-hash başına maks. 2 cihaz sayılır |
| C4 | **Test yoxdur** (server və müştəri) — `npm test` belə mövcud deyil | — | Reqressiyalar görünmür | ✅ 3 qat test + CI |
| C5 | `app.js` import olunduqda serveri, DB-ni və simulyatoru işə salır — tətbiqi test etmək mümkün deyil | `app.js` | Arxitektura | ✅ `core/createApp.js` (fabrika) + `app.js` (giriş nöqtəsi) |

## 🟡 Arxitektura və kod keyfiyyəti

| # | Problem | Status |
|---|---|---|
| A1 | NoSQL sanitizer `__proto__` / `constructor` / `prototype` açarlarını süzmür (prototip çirklənməsi) | ✅ |
| A2 | Dispetçer əmri mətni və parametrləri limitsizdir (çox böyük mətn bazaya yazılır və socket ilə yayılır) | ✅ mətn ≤ 1000, parametr ≤ 120 simvol |
| A3 | «Gedirəm» (`/api/intents`) və `/api/plan` yalnız ümumi limitə (100/dəq) tabedir. Plan CPU baxımından ağırdır, niyyətlər proqnoz xəbərdarlığını tetikləyir | ✅ ayrıca limitlər |
| A4 | Niyyətdə `stopId`/`lat`/`lng` yoxlanılmır (NaN və obyekt bazaya düşə bilər) | ✅ |
| A5 | Canlı lokasiya (B): bir IP limitsiz socket açıb «canlı sərnişin» sayını şişirdə bilər | ✅ IP başına maks. 3 |
| A6 | Development CORS siyahısı sərt kodlanıb (`5173`), `CLIENT_URL` nəzərə alınmır | ✅ |
| A7 | Dil dəyişəndə server tərəfindən lokallaşdırılan RTK keşləri (AI xülasə, şablonlar, plan) köhnə dildə qalır. Komponentlərdə `refetch` əlavə edilmişdi | ✅ `Localized` tag + bir mərkəzi invalidasiya |
| A8 | Əsas JS bundle 595 KB | ✅ `i18n` və `map` ayrıca chunk-lar |
| A9 | Xəritə HTML-i (heatmap) server rəqəmlərini birbaşa HTML-ə yazır | ✅ `Number()` ilə məcburi çevrilmə |
| A10 | Demo məlumat: 4 uydurma xətt, yolu izləməyən düz xətlər | ✅ 13 real xətt (report.az + H1 Aeroekspres), prospektlər üzrə ara nöqtələr, köhnə demo avtomatik əvəz olunur |
| A11 | JSON gövdə limiti 10 MB idi (fayl yükləmə limiti ilə eyni) | ✅ 100 KB (`JSON_PAYLOAD_LIMIT`) |
| A12 | Server ESLint-də `no-undef` söndürülmüşdü | ✅ aktiv |

## 🟢 Çatışmayan funksiyalar və cilalama təklifləri

| # | Təklif | Status |
|---|---|---|
| P1 | CI (lint + test + i18n + build) | ✅ `.github/workflows/ci.yml` |
| P2 | Real vaxt datası: AYNA / BakuBus GTFS və GTFS-RT adapteri (`POST /api/routes/buses/:busId/location` artıq var) | Təklif |
| P3 | OSM-dən tam yol həndəsəsi (`route.path`) və ya OSRM ilə yola bağlama | Təklif (sxem hazırdır) |
| P4 | PWA (offline xəritə keşi, «Gedirəm» push bildirişi) | Təklif |
| P5 | Docker Compose (Mongo + server + client) — münsiflər üçün tək əmrlə işə salma | Təklif |
| P6 | Anomaliya qaydası üçün geri əlaqə: dispetçer «saxta həyəcan» qeyd etsin → modelin kalibrlənməsi | Təklif |
| P7 | Əlçatanlıq: ekran oxuyucu ilə tam keçid testi (axe) | Təklif |

---

## Testlər

| Qat | Alət | Nəyi yoxlayır |
|---|---|---|
| Server unit | `node:test` (Node daxili, yeni paket yoxdur) | sıxlıq aqreqasiyası, anomaliya (Sybil daxil), +20% artım, dispetçer formulu, proqnoz, geo, i18n, şablon doldurma, sanitizer, seed data bütövlüyü |
| Server inteqrasiya | `node:test` + real HTTP (`createApp`) + in-memory model qatı | marşrutlar, ETA, bildiriş + cooldown, plan, «Gedirəm», chatbot, dillər, dispetçer əmri, anomaliyanın yaranması |
| Server təhlükəsizlik | eyni | 401/403 (auth və rol), JWT saxtalaşdırma, NoSQL injection, prototip çirklənməsi, böyük payload (413), rate limit (429), helmet başlıqları, CORS, xəta mesajında stack olmaması, prodakşn konfiqurasiya qoruyucuları |
| Müştəri | Vitest + Testing Library + jsdom | format/cəm formaları (AZ/EN/RU), XSS-ə qarşı escape, istiqamət məntiqi, komponentlər (gəliş kartları, dil dəyişdirici, sıxlıq nişanı), tərcümə açarlarının bütövlüyü |

İşə salma: `npm test` (kökdə: server + client).

**Nəticə:** server 68/68 (unit 27, inteqrasiya 16, təhlükəsizlik 25), müştəri 29/29. ESLint təmizdir, build xəbərdarlıqsızdır.

**Gemini proqnozu əlavə edildikdən sonra:** server 91/91 (Gemini müştərisi saxta `fetch` ilə, model cavabının yoxlanılması, hava və tıxac göstəriciləri, `/api/analytics/predict` üçün auth, keş və fallback), müştəri 34/34 (proqnoz kartı, XSS, cəm formaları).

**Testlərin tapdığı problemlər:**
- `GET /api/health` → 500. Refaktor zamanı `mongoDBService` importu itmişdi, ESLint isə `no-undef` söndürülü olduğu üçün bunu tutmamışdı. Düzəldildi və `no-undef: error` aktiv edildi.
- ETA cavabında bildirişi olmayan avtobusun `crowd` obyektində `loadPct` sahəsi yox idi (müqavilə uyğunsuzluğu). Düzəldildi.
- Xəta emalçısı hər 4xx cavabını «Server error» kimi loqa yazırdı. İndi yalnız 5xx yazılır, stack ilə.

**In-memory DB haqqında:** inteqrasiya testləri MongoDB tələb etmir. `#models` testdə eyni API-li yaddaş qatı ilə əvəz olunur (`server/tests/support/`), ona görə Mongoose sxem validasiyası bu testlərdə yoxlanılmır.
