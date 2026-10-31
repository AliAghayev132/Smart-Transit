# Smart Transit Bakı 🚌

Bakı avtobuslarında **real-vaxt sərnişin sıxlığı**, marşrut planlama, **dispetçer idarəetmə paneli** və **Gemini AI ilə 1–2 saatlıq proqnoz**. MERN: `server/` (Express 5 + Socket.IO + MongoDB) və `client-react/` (Vite + React 19 + Tailwind 4 + RTK Query).

## 📄 Təqdimat sənədləri

| Sənəd | Məzmun |
|---|---|
| [Lokal mühitdə başlatma](docs/SETUP.md) | `git clone`, `npm install`, `.env` açarları, `npm run dev`, demo ssenarisi |
| [Sistem arxitekturası](docs/ARCHITECTURE.md) | React SPA, Express REST API, MongoDB sxemləri, CARTO / Gemini / Open-Meteo |
| [AI istifadəsi haqqında bəyannamə](docs/AI-DECLARATION.md) | Hansı AI alətləri, hansı məqsədlə və hansı promptlarla istifadə olunub |
| [Texniki izah sənədi](docs/TECHNICAL.md) | Problem, seçilmiş texnologiyalar, layihənin strukturu, gələcək inkişaf |

Əlavə: [AI strategiyası](docs/AI-STRATEGY.md) · [Operator UX](docs/OPERATOR-UX.md) · [Dizayn sistemi](docs/DESIGN-SYSTEM.md) · [Audit hesabatı](docs/AUDIT-REPORT.md)

---

## Modullar

| Modul | Nə edir |
|---|---|
| **Sərnişin** (`/`) | Haradan → Haraya planlayıcı, canlı avtobuslar, gəliş vaxtı, sıxlıq bildirişi (Az / Orta / Yüksək), «Gedirəm», canlı lokasiya paylaşımı, AI chatbot |
| **Crowdsourcing + analitika** | GPS ilə yoxlanan bildirişlər → xətt / avtobus / seqment sıxlığı və heatmap; 10 dəq «Yüksək» → «Əlavə avtobus ehtiyatı ayrılmalıdır» |
| **Gemini proqnozu** | Tarixi data, pik saatlar, hava və tıxac əsasında növbəti 1–2 saatın sıxlıq sıçrayışları və avtobusların yerdəyişməsi (`GET /api/analytics/predict`) |
| **Sıxlıq A — proaktiv** | «Gedirəm» niyyətləri → dayanacaq üzrə gözlənilən minik, proqnoz xəbərdarlığı |
| **Sıxlıq B — canlı lokasiya** | Anonim canlı mövqe → heatmap, dayanacaqda gözləyənlər, avtobusdakılar |
| **Dispetçer paneli** (`/dashboard`) | Xəritə + sağ panel, AI xülasəsi, ehtiyat avtobus tövsiyəsi, əmr şablonları, banner, qısa yollar |

**Dillər:** Azərbaycan, ingilis, rus (interfeys, server mesajları, AI cavabları). **Tema:** işıqlı / qaranlıq.

---

## Tez başlanğıc

Tələb: **Node.js ≥ 20.19** və **MongoDB**. Ətraflı: [docs/SETUP.md](docs/SETUP.md).

```bash
git clone <repo-url> smart-transit && cd smart-transit
npm run install:all
cp server/.env.example server/.env              # Windows: Copy-Item server\.env.example server\.env
cp client-react/.env.example client-react/.env  # Windows: Copy-Item client-react\.env.example client-react\.env
# server/.env: MONGODB_URI, sirlər, GEMINI_API_KEY; client-react/.env: VITE_CARTO_API_KEY
npm run dev
```

- Sərnişin: http://localhost:5173 · Dispetçer: http://localhost:5173/login (`operator@example.com` / `Operator123!`)
- İlk açılışda **13 real BakuBus xətti** (1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, H1 Aeroekspres) və 45 avtobus yaradılır. Sıfırlamaq: `npm run seed:reset`.

### Açarlar

| Açar | Fayl | Nə üçün | Olmasa |
|---|---|---|---|
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`) | `server/.env` | Operator panelində 1–2 saatlıq proqnoz | deterministik baza modeli |
| `VITE_CARTO_API_KEY` (+ tile URL-ləri) | `client-react/.env` | CARTO xəritə plitələri (işıqlı / qaranlıq) | açarsız CARTO / OSM |
| `WEATHER_ENABLED` | `server/.env` | Open-Meteo hava siqnalı (açarsız) | proqnoz havasız |
| `OPENROUTER_API_KEY` | `server/.env` | AI xülasə, tövsiyə izahı, chatbot | qayda əsaslı mətnlər |
| `VITE_GOOGLE_MAPS_API_KEY`, `GOOGLE_ROUTES_API_KEY` | client / server | Google Maps, Places, Routes | Leaflet + Photon + daxili planlayıcı |
| `CROWD_DISPLAY_BOOST_PCT` (standart `20`) | `server/.env` | Göstərilən sıxlıq bu faiz qədər artırılır | `0` → real dəyərlər |

Gizli açarlar yalnız `server/.env`-də saxlanılır və git-ə düşmür.

---

## Demo ssenarisi

1. `/login` → dispetçer hesabı ilə daxil olun. Sağ paneldə **Gemini proqnozu** kartı görünür.
2. **Test alətləri** → xətt seçin → «Yüksək» dalğası (2–3 dəfə) → qırmızı banner + səs + tövsiyə.
3. **Tövsiyəni təsdiqlə** → ehtiyat avtobuslar xəritədə, əmr jurnala yazılır.
4. `J`/`K`, `D`, `R`, `C`, `T`, `?` qısa yollarını sınayın.
5. `/` (sərnişin): «Haradan / Haraya» → `Sahil` → `Koroğlu` → «Gedirəm»; sağ-aşağıda chatbot.

---

## API (qısa)

| Metod | Yol | Giriş |
|---|---|---|
| GET | `/api/routes`, `/api/routes/buses`, `/api/routes/:id/stops/:stopId/eta` | public |
| POST | `/api/reports` | public (rate limit + cihaz cooldown) |
| GET | `/api/analytics/crowd` | public |
| GET | `/api/analytics/heat · /forecast · /forecast/:routeId · /timeseries` | operator |
| GET | `/api/analytics/predict` — Gemini proqnozu (`?refresh=1`) | operator |
| POST | `/api/plan`, `/api/intents`; GET `/api/demand/nearby` | public |
| GET/PATCH | `/api/alerts`, `/api/alerts/:id` | operator |
| GET/POST | `/api/dispatch/templates · /recommend/:routeId · /commands · /preview` | operator |
| GET/POST | `/api/ai/status`, `/api/ai/chat` (public) · `/api/ai/summary/:routeId`, `/api/ai/dispatch/:routeId` (operator) | — |
| POST | `/api/routes/buses/:busId/location` — real GPS treker | operator |
| POST | `/api/demo/*` | operator, `DEMO_ENABLED` |

Cavab formatı: `{ success, message?, data? }`. Dil: `Accept-Language: az | en | ru` və ya `?lang=`.

---

## Yoxlama və testlər

```bash
npm test              # server (91) + client (34)
npm run lint          # ESLint
npm run i18n:check    # AZ / EN / RU açarları
npm run build         # client production build
```

| Qat | Yer | Alət |
|---|---|---|
| Server unit | `server/tests/unit/` | `node:test` |
| Server inteqrasiya | `server/tests/integration/` | real Express + in-memory model qatı (MongoDB lazım deyil) |
| Server təhlükəsizlik | `server/tests/security/` | auth / rol, JWT, injection, 413, rate limit, CORS, başlıqlar, Sybil |
| Client | `client-react/src/**/*.test.{js,jsx}` | Vitest + Testing Library + jsdom |

CI workflow: `docs/ci-workflow.yml` → `.github/workflows/ci.yml` qovluğuna köçürün.
