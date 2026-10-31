# Layihənin lokal mühitdə başladılması

Bu təlimat Smart Transit Bakı-nı (server + veb tətbiq) öz kompüterinizdə 10–15 dəqiqəyə işə salmaq üçündür.

## 1. Tələblər

| Alət | Versiya | Qeyd |
|---|---|---|
| Node.js | **≥ 20.19** (22 LTS tövsiyə olunur) | `node -v` ilə yoxlayın |
| npm | 10+ | Node ilə gəlir |
| MongoDB | 7+ | Lokal (`mongodb://localhost:27017`) və ya MongoDB Atlas |
| Git | istənilən | |

Açarlar (isteğe bağlı, amma tövsiyə olunur):

| Açar | Harada alınır | Olmasa nə olur |
|---|---|---|
| Gemini API açarı | [Google AI Studio](https://aistudio.google.com/apikey) | Operator proqnozu deterministik baza modeli ilə hazırlanır |
| CARTO API açarı | CARTO hesabı | Xəritə açarsız CARTO / OpenStreetMap plitələri ilə açılır |
| OpenRouter açarı | openrouter.ai | AI xülasəsi və chatbot qayda əsaslı rejimdə işləyir |
| Google Maps / Routes açarı | Google Cloud Console | Leaflet xəritəsi və OSM (Photon) axtarışı istifadə olunur |

Tətbiq açarsız da tam işləyir; açarlar yalnız AI və xəritə keyfiyyətini artırır.

## 2. Kodu yükləyin

```bash
git clone <repo-url> smart-transit
cd smart-transit
```

## 3. Paketləri quraşdırın

Kök qovluqdan bir əmr (kök, `server/` və `client-react/` paketləri):

```bash
npm run install:all
```

Və ya ayrı-ayrı:

```bash
npm install
npm install --prefix server
npm install --prefix client-react
```

## 4. `.env` fayllarını yaradın

Hər iki paketdə nümunə fayldan nüsxə çıxarın.

**Windows (PowerShell):**

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client-react\.env.example client-react\.env
```

**macOS / Linux:**

```bash
cp server/.env.example server/.env
cp client-react/.env.example client-react/.env
```

### `server/.env` — vacib dəyişənlər

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_transit
CLIENT_URL=http://localhost:5173

# JWT və şifrələmə: ən azı 32 simvolluq təsadüfi sətirlər
ACCESS_SECRET_KEY=<təsadüfi-sətir>
REFRESH_SECRET_KEY=<təsadüfi-sətir>
ENCRYPTION_KEY=<təsadüfi-sətir>

# İlk açılışda yaradılan hesablar
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin123!
DEFAULT_OPERATOR_EMAIL=operator@example.com
DEFAULT_OPERATOR_PASSWORD=Operator123!

# Gemini — operator panelində 1–2 saatlıq proqnoz
GEMINI_API_KEY=<Gemini açarınız>
GEMINI_MODEL=gemini-3.5-flash

# Hava (Open-Meteo, açar tələb etmir)
WEATHER_ENABLED=true

# İsteğe bağlı
OPENROUTER_API_KEY=
GOOGLE_ROUTES_API_KEY=
```

Təsadüfi sətir yaratmaq üçün:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `client-react/.env` — vacib dəyişənlər

```env
VITE_API_URL=http://localhost:5000
VITE_SITE_URL=http://localhost:5173

# CARTO xəritə plitələri
VITE_CARTO_API_KEY=<CARTO açarınız>
VITE_CARTO_TILE_URL=https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
VITE_CARTO_TILE_URL_DARK=https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png

# İsteğe bağlı: Google Maps (yoxdursa Leaflet istifadə olunur)
VITE_MAP_PROVIDER=auto
VITE_GOOGLE_MAPS_API_KEY=
```

> **Təhlükəsizlik.** `server/.env` git-ə düşmür (`.gitignore`). Gemini, OpenRouter və Google Routes açarlarını yalnız orada saxlayın. `VITE_` ilə başlayan açarlar brauzerdə görünür, ona görə CARTO və Google Maps açarlarını panellərində domenlə (`localhost`, öz domeniniz) məhdudlaşdırın.

## 5. MongoDB-ni işə salın

- **Lokal:** MongoDB xidmətini başladın (Windows-da «MongoDB Server» servisi, macOS-da `brew services start mongodb-community`).
- **Atlas:** klaster yaradın, IP-nizi icazə siyahısına əlavə edin və `MONGODB_URI`-yə `mongodb+srv://...` sətrini yazın.

## 6. Tətbiqi işə salın

Kökdən server və veb tətbiqi birlikdə:

```bash
npm run dev
```

| Xidmət | Ünvan |
|---|---|
| Sərnişin tətbiqi | http://localhost:5173 |
| Dispetçer paneli | http://localhost:5173/login |
| API | http://localhost:5000/api |
| Sağlamlıq yoxlaması | http://localhost:5000/api/health |

Ayrı terminallarda da işlədə bilərsiniz: `npm run dev:server` və `npm run dev:client`.

İlk açılışda server avtomatik yaradır:

- 13 real BakuBus xətti (1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14 və H1 Aeroekspres) və 45 avtobus;
- admin və dispetçer hesabları (`.env`-dəki e-poçt və parollarla).

Konsolda `🚌 Fleet: 13 xətt, 45 avtobus yükləndi` görünürsə, hər şey hazırdır.

## 7. Demo ssenarisi (2 dəqiqə)

1. http://localhost:5173/login → `operator@example.com` / `Operator123!`.
2. Sağ paneldə **Gemini proqnozu** kartı: növbəti 2 saatda gözlənilən sıxlıq sıçrayışları, avtobusların yerdəyişməsi, hava və tıxac.
3. Paneldəki **Test alətləri** ilə bir xəttə «Yüksək» dalğası göndərin (2–3 dəfə) → qırmızı banner «Əlavə avtobus ehtiyatı ayrılmalıdır» və dispetçer tövsiyəsi.
4. **Tövsiyəni təsdiqlə** → ehtiyat avtobuslar xəritədə görünür, əmr jurnala yazılır.
5. http://localhost:5173 (sərnişin): «Haradan / Haraya» → `Sahil` → `Koroğlu` → **Gedirəm**; sıxlıq bildirişi göndərin; sağ-aşağıda chatbot.

## 8. Faydalı əmrlər

| Əmr | Nə edir |
|---|---|
| `npm test` | Server və veb tətbiq testləri |
| `npm run lint` | ESLint (server + client) |
| `npm run i18n:check` | AZ / EN / RU tərcümə açarlarının bütövlüyü |
| `npm run build` | Veb tətbiqin production build-i (`client-react/dist`) |
| `npm run seed:reset` | Xətləri və avtobusları sıfırdan yaradır |

## 9. Problemlərin həlli

| Əlamət | Səbəb və həll |
|---|---|
| `MongooseServerSelectionError` | MongoDB işləmir və ya `MONGODB_URI` yanlışdır |
| Server açılmır: «weak secret» xətası | `NODE_ENV=production` rejimində standart açar və parollar qadağandır. Güclü dəyərlər yazın |
| Xəritə boz qalır | `VITE_CARTO_API_KEY` və ya internet bağlantısını yoxlayın. Açarsız rejim də işləyir |
| Proqnoz kartında «Baza modeli» | `GEMINI_API_KEY` boşdur və ya Gemini cavab vermədi. Server loqunda `⚠️ Gemini proqnozu alınmadı` sətrinə baxın |
| Brauzer CORS xətası | `server/.env`-də `CLIENT_URL` veb tətbiqin ünvanı ilə eyni olmalıdır |
| Portlar məşğuldur | `PORT` (server) və ya `npx vite --port 5174` ilə dəyişin; `VITE_API_URL`-i uyğunlaşdırın |
