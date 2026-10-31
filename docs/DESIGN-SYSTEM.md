# Dizayn sistemi və çoxdillilik

Smart Transit interfeysi «Six-O» prinsiplərinə əsaslanır: **bir baxışda əsas məlumat** (avtobus neçə dəqiqəyə gəlir, nə qədər doludur), iri və qalın rəqəmlər, iri radiuslu «qalın» kartlar, aktiv xəttin rəngi ekrana hakimdir. Qalan hər şey sakit qalır.

---

## 1. Rəng tokenləri

Bütün rənglər `client-react/src/App.css` faylında CSS dəyişənləridir. İşıqlı rejim `@theme`-dədir, qaranlıq rejim `.dark`-da. Tailwind utilitləri birbaşa tokenlərdən yaranır, ona görə komponentlərdə `dark:` variantı yazmağa ehtiyac yoxdur.

| Token | Utilit | İşıqlı | Qaranlıq | Harada |
|---|---|---|---|---|
| canvas | `bg-canvas` | `#F8F9FA` | `#121212` | Səhifə fonu |
| deep | `bg-deep` | `#ECEEF1` | `#000000` | Xəritə arxası, operator sidebar-ı |
| surface | `bg-surface` | `#FFFFFF` | `#1C1C1E` | Kartlar |
| raised | `bg-raised` | `#F1F3F5` | `#2A2A2E` | Çiplər, inputlar |
| ink | `text-ink` | `#1A1A1A` | `#F5F5F7` | Əsas mətn |
| ink-soft | `text-ink-soft` | `#555B63` | `#B3B3BC` | İkinci dərəcəli mətn |
| line | `border-line` | `#E2E5E9` | `#2F2F34` | Xətlər |
| brand | `bg-brand` | `#0B5FDB` | `#3D9BFF` | Əsas əməliyyat (Bakı avtobuslarının mavisi) |
| go | `bg-go` | `#00803C` | `#2BF27F` | «GO / Gedirəm», canlı siqnal |
| crowd-low / mid / high | `text-crowd-*` | `#087A45` / `#B45309` / `#D1242F` | `#3DDC84` / `#FFB020` / `#FF5468` | Sıxlıq |

- Kontrast WCAG AA tələbinə uyğunlaşdırılıb: əsas mətn 16:1, ikinci dərəcəli mətn 6.5:1, düymələr 5:1-dən yuxarı.
- Qaranlıq rejimdə kölgə əvəzinə nazik halqa (`--shadow-card`) istifadə olunur.
- Xətt rəngləri data-dan gəlir. Ağ mətnin altında `routeShade()` (rəngin 80%-i + qara) işlədilir ki, narıncı və yaşıl xətlərdə də kontrast saxlanılsın.
- SVG və xəritə (Leaflet, recharts) `var()` qəbul etmir. Orada `CROWD_HEX` / `useCrowdHex()` istifadə olunur. Hex dəyərləri `App.css` ilə sinxron saxlanılmalıdır.

## 2. Tipoqrafiya

- **Nunito** (Google Fonts) bütün interfeys üçün vahid ailədir. Həm latın əlifbasını (**ə, ğ, ı, ş, ç, ö, ü** daxil), həm də kirili tam dəstəkləyir, ₼ işarəsi də var. Rubik və Inter də yoxlanıldı: Rubik-də «ə» hərfi yoxdur.
- Ölçülər: `text-hero` (xətt nömrəsi, 52–72px, 900), `text-giant` (dəqiqə kartları, 52px, 900), `text-title` (22px, 800), mətn 14–18px.
- Yeganə italik vurğu «GO / Gedirəm / Еду» düyməsidir (`.go-btn`).

## 3. Komponentlər (sərnişin)

| Komponent | Fayl | Rolu |
|---|---|---|
| Gəliş kartları | `components/transit/DepartureCards.jsx` | Növbəti 3 avtobus: iri dəqiqə rəqəmi, canlı siqnal, 3 nöqtəli doluluq |
| Səfər kartı + GO | `TripPlanner.jsx`, `GoButton.jsx` | «Çıxış / Çatma», müddət, səfər zolağı; GO «Gedirəm» niyyətini qeydə alır (Yanaşma A) |
| Xətt zolağı | `LegBand.jsx` | Xətt rəngində zolaq: iri nömrə, istiqamət, minmə və düşmə saatları |
| Xətt görünüşü | `RouteView.jsx` | Nömrə, istiqamət dəyişimi, dayanacaq üzrə gəlişlər, sıxlığı bildirmə, dayanacaqlar xətti |
| Avtobus nişanı | `components/map/mapModel.js` + `App.css .bus-mk` | Ağ disk, avtobus ikonu (xətt rəngində), nömrə və doluluq nöqtələri; ehtiyat avtobusda sarı kəsik halqa |

Sıxlıq heç vaxt yalnız rənglə göstərilmir: nöqtə sayı (1/2/3) və söz də həmişə yanındadır.

## 4. Çoxdillilik (AZ / EN / RU)

- Kitabxana: `i18next` + `react-i18next` (`src/lib/i18n.js`).
- Fayllar: `src/locales/<az|en|ru>/<namespace>.json`.
  - `common` — sıxlıq, vaxt, düymələr, xəritə
  - `passenger` — sərnişin modulu
  - `operator` — dispetçer paneli
- Cəm formaları `key_one / _few / _many / _other` şəklindədir. Rus dili üçün `_few` və `_many` mütləqdir, məsələn «2 минуты», «5 минут».
- Dil seçimi `localStorage` (`st_lang`), sonra brauzer dili, sonra `az` ardıcıllığı ilə olur. `<html lang>` avtomatik yenilənir.
- **Server də seçilmiş dildə cavab verir.** Hər sorğuya `Accept-Language` başlığı əlavə olunur (`store/api/baseApi.js`). Server bu dildə qaytarır:
  - xəta və təsdiq mesajlarını
  - dispetçer şablonlarını
  - AI xülasəsini və chatbot cavablarını
- Tövsiyə səbəbləri (`reasons: [{ code, params }]`) və xəbərdarlıq tarixçəsi (`noteKey`) kod kimi gəlir və müştəridə tərcümə olunur. Bir xəbərdarlığı müxtəlif dilli operatorlar eyni anda görə bilər.
- Uzun AZ və RU sözləri üçün layout `flex-wrap`, `min-w-0` və `overflow-wrap: break-word` ilə qurulub. `hyphens: auto` da aktivdir.

**Yeni mətn əlavə etmək:** açarı üç dildə də yazın. Yoxlama skripti hər üç dildə açar dəstinin eyni olduğunu təsdiqləyir (bax README → «Yoxlama»).

## 5. Sıxlığın göstərilməsi (+20%)

`CROWD_DISPLAY_BOOST_PCT=20` (`server/.env`). Hesablanmış doluluq göstərilməzdən əvvəl 20% artırılır, məsələn «Orta» 85% → 102% → «Yüksək». Canlı sərnişin sayları da artırılır: dayanacaqda gözləyənlər, avtobusdakılar, heatmap.

- Sərnişin, operator paneli, AI və dispetçer tövsiyəsi eyni rəqəmi görür.
- 10 dəqiqəlik «Yüksək» anomaliya qaydası xam bildirişlərlə işləyir.
- Bildiriş sayı və «Gedirəm» sayı dəyişmir, çünki bunlar istifadəçi əməliyyatlarının dəqiq sayıdır.
- `0` yazsanız, real dəyərlər göstərilir.
