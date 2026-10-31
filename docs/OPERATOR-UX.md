# Operator modulu — UX/UI və texniki dizayn

Dispetçer panelinin məqsədi: **anomaliyanı görməkdən ehtiyat avtobusu xəttə çıxarmağa qədər olan vaxtı 1 dəqiqədən aşağı salmaq.** Bunun üçün hər şey bir ekranda toplanır: xəritə mərkəzdə, seçilmiş xəttin konteksti və AI tövsiyəsi sağda, xəbərdarlıqlar isə həm banner, həm də siyahı kimi görünür.

---

## 1. İstifadəçi axını (User Flow)

```
[1] Giriş (/login)
     operator@… → JWT auth → yalnız operator/admin rolu panelə buraxılır
        │
[2] Xəritə (/dashboard) — ümumi görünüş
     • xəritədə: seqmentlər sıxlığa görə rənglənib, avtobuslar canlı hərəkət edir
     • sağda: aktiv xəbərdarlıqlar, xətlər (sıxlıq + trend), canlı (B) və tələb (A) xülasəsi
        │
[3] Anomaliya (10 dəq ərzində «Yüksək», və ya «Gedirəm» proqnozu)
     • server RouteAlert yaradır → dispetçer tövsiyəsini dərhal əlavə edir → socket: alert:new
     • panel: yuxarıda QIRMIZI BANNER + səs, menyuda «Anomaliyalar» nişanı (say)
        │
[4] Qərar — 3 yol (hamısı eyni məntiq: hooks/useAlertActions)
     a) Banner → «Tövsiyəni təsdiqlə (N)»     — 1 klik
     b) Banner → «Xəritədə bax» → sağ panel: AI xülasəsi, tövsiyə, proqnoz, son bildirişlər
        → «AI izahı və əmr mətni» → mətni redaktə et → «Təsdiqlə»
     c) Klaviatura: J/K ilə xəbərdarlığı seç → D (ehtiyat ayır) / C (əmr yaz)
        │
[5] İcra
     • DispatchCommand jurnala yazılır, N ehtiyat avtobus ən sıx seqmentin başlanğıcından xəttə çıxır
     • xəbərdarlıq statusu: Yeni → Ehtiyat ayrıldı; xəritədə ehtiyat avtobus sarı kəsik haşiyə ilə
        │
[6] Monitorinq → Bağlama
     • tövsiyə panelində doluluq/interval «əvvəl → sonra»; sıxlıq düşəndə R (Həll olundu)
     • bağlananda ehtiyat avtobuslar geri çağırılır; tarixçə və əmrlər «Anomaliyalar» səhifəsində
```

---

## 2. Ekran layout-u

```
┌──────────┬──────────────────────────────────────────────┬────────────────────────┐
│ SOL MENYU│ HEADER: səhifə · ● Canlı · AI statusu · ☾/☀ · istifadəçi              │
│          ├──────────────────────────────────────────────┬────────────────────────┤
│ 🗺 Xəritə │                                              │ SAĞ KONTEKST PANELİ    │
│ 🚌 Xətlər │   MƏRKƏZİ İŞ SAHƏSİ                           │ (xətt seçilib)         │
│ ⚠ Anomal.│   Google Maps  ⇄  Leaflet/OSM (fallback)      │ • №5 · Yüksək · statlar│
│   (say)  │   • seqment sıxlığı (Az/Orta/Yüksək)          │ • seqment zolağı       │
│ 📊 Hesab.│   • bildiriş nöqtələri                         │ • ✨ AI xülasəsi        │
│          │   • canlı istifadəçilər (B) — heatmap          │ • aktiv xəbərdarlıqlar │
│          │   • gözlənilən tələb (A) — halqalar            │ • 🪄 dispetçer tövsiyəsi│
│ ⌨ Qısa   │   • avtobuslar (ehtiyat — sarı haşiyə)         │   [AI izahı] [Təsdiqlə]│
│   yollar │   [Qatlar: Seqment|Bildiriş|Canlı|Tələb]       │ • proqnoz (3 saat)     │
│ ⎋ Çıxış  │                                              │ • son bildirişlər (canlı)│
└──────────┴──────────────────────────────────────────────┴────────────────────────┘
```

| Bölmə | Səhifə / komponent |
|---|---|
| Sol menyu + header | `layouts/DashboardLayout.jsx` (yığıla bilən yan menyu) |
| Xəritə | `pages/dashboard/MapPage` → `components/map/MapView` |
| Sağ panel (xətt) | `components/operator/RouteContextPanel` |
| Sağ panel (ümumi) | `components/operator/OverviewPanel` |
| Xətlər | `pages/dashboard/RoutesPage` — sıxlıq, trend, canlı (B), «Gedirəm» (A), 3 saatlıq proqnoz |
| Anomaliyalar | `pages/dashboard/AlertsPage` — filtrlər, tarixçə, əmrlər, tövsiyə |
| Hesabatlar | `pages/dashboard/ReportsPage` — bildiriş həcmi (recharts), xətlər üzrə, dispetçer jurnalı |

---

## 3. AI dəstəkli və avtomatlaşdırılmış alətlər

| Alət | Necə işləyir | Komponent |
|---|---|---|
| **Avtomatik banner** | `alert:new` → banner + səs, 15 san sonra özü bağlanır, «Xəritədə bax» / «Tövsiyəni təsdiqlə» | `AlertBanner` |
| **AI xülasəsi** | Xəttin vəziyyəti 3–4 cümlədə; 2 dəq-dən bir yenilənir; AI yoxdursa qaydalar | `AISummaryCard` |
| **Dispetçer tövsiyəsi** | Neçə avtobus, interval və doluluq «əvvəl → sonra», etibar, səbəblər | `RecommendationPanel` |
| **AI izahı + əmr mətni** | LLM rəqəmi dəyişmədən əsaslandırır və əmr mətnini hazırlayır → redaktə → «Təsdiqlə» | `RecommendationPanel` |
| **Əmr şablonları** | Ehtiyat buraxılışı, interval qısaltma, short-turn, ekspress reys, başqa xəttdən yönləndirmə, sərbəst | `DispatchModal` (C) |

Şablonlar serverdədir (`server/constants/shared/dispatchTemplates.js`) — yer tutucular (`{route}`, `{count}`, `{stop}`…) avtomatik doldurulur, operator mətni dəyişə bilər.

---

## 4. Klaviatura qısa yolları

| Düymə | Əməliyyat |
|---|---|
| `1` `2` `3` `4` | Xəritə · Xətlər · Anomaliyalar · Hesabatlar |
| `J` / `K` | Növbəti / əvvəlki aktiv xəbərdarlıq |
| `A` | Seçilmiş xəbərdarlığı qəbul et |
| `D` | Tövsiyə olunan sayda ehtiyat avtobus ayır |
| `R` | Həll olundu (ehtiyatlar geri çağırılır) |
| `C` | Dispetçer əmri yaz |
| `T` | Qaranlıq / işıqlı rejim |
| `?` | Qısa yollar pəncərəsi |
| `Esc` | Pəncərəni / banneri / seçimi bağla |

Qısa yollar input-a yazarkən işləmir (`hooks/useKeyboardShortcuts.js`).

---

## 5. Dark / Light rejimi və dil

- Başlıqda **AZ | EN | RU** dəyişdiricisi var. Bütün panel, server mesajları, AI xülasəsi və dispetçer şablonları seçilmiş dildə gəlir. Bir xəbərdarlığı fərqli dilli operatorlar eyni anda görə bilər, çünki tövsiyə səbəbləri kod kimi saxlanılır.

- `store/context/ThemeContext.jsx` — seçim `localStorage`-da saxlanılır, ilk dəfə sistemin rejiminə uyğunlaşır.
- Rənglər CSS tokenləridir (`App.css`): işıqlı — `#F8F9FA` fon / `#1A1A1A` mətn, qaranlıq — `#121212` / `#000000` fon, neon yaşıl və parlaq mavi vurğular. Komponentlərdə `dark:` variantı yazılmır — `bg-surface`, `text-ink` kimi tokenlər rejimlə özü dəyişir. Ətraflı: [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).
- Xəritə də rejimə uyğunlaşır: Leaflet — CARTO/Mapbox qaranlıq plitələri, Google — `colorScheme="DARK"`.
- `index.html`-də kiçik skript ilk yükləmədə «ağ yanıb-sönmə»nin qarşısını alır.

---

## 6. Texniki tələblər

### Xəritə və alternativlər
- **Google Maps** (`@vis.gl/react-google-maps`): Advanced Markers, Places (New) autocomplete, Geocoder.
- **Fallback**: açar yoxdur / səhvdir / billing yoxdur / 10 san-də yüklənmədi → **Leaflet/OSM**; Leaflet plitələri də zəncirvaridir: Mapbox → CARTO → OSM.
- Routing: öz planlayıcımız (`PlannerService`) + isteğe bağlı **Google Routes API** (TRANSIT) alternativləri.

### Sərnişin sıxlığı məntiqi
- Crowdsourcing `low | mid | high` → zamanla sönən çəki (yarım ömür 5 dəq), GPS-təsdiqli bildiriş 1.0, təsdiqsiz 0.4.
- Xətt, avtobus və **dayanacaqlar arası seqment** üzrə səviyyə (bildirişin GPS nöqtəsi xəttə proyeksiya olunur).
- Anomaliya: son 10 dəq-də ≥3 unikal cihazdan «Yüksək» və «Yüksək» payı ≥60%.

### MongoDB sxemləri

```js
// DensityReport — server/models/densityReport.model.js
{
  route: ObjectId,               // ref Route
  bus: ObjectId,                 // ref Bus (isteğe bağlı)
  stopId: ObjectId,
  level: "low" | "mid" | "high",
  location: { type: "Point", coordinates: [lng, lat] },   // 2dsphere
  source: "gps" | "bus" | "stop" | "none",
  verified: Boolean,             // GPS avtobusa ≤300 m
  distanceToBusM: Number,
  deviceId: String,              // anonim; cooldown 60 san
  createdAt, updatedAt           // TTL 30 gün
}
// indekslər: { route, createdAt }, { location: 2dsphere }, TTL { createdAt }

// RouteAlert — server/models/routeAlert.model.js
{
  route: ObjectId,
  type: "RESERVE_BUS_NEEDED" | "DEMAND_FORECAST",
  message: String,
  status: "open" | "acknowledged" | "dispatched" | "resolved",
  stats: Mixed,                  // {highReports, totalReports, highRatio, windowMin} | {confirmedIntents, topStop}
  recommendation: Mixed,         // {recommendedBuses, headwayNowMin→AfterMin, loadNowPct→AfterPct, confidence, reasons}
  reserveBuses: [ObjectId],
  history: [{ status, at, note, by }],
  resolvedAt: Date
}
// indekslər: { route, type, status }, { createdAt: -1 }
// metodlar: statics.findActiveFor(routeId, type), methods.transition(status, note, by)

// DispatchCommand — əmrlər jurnalı
{ route, alert, type, text, params, source: "manual" | "ai", reserveBuses, issuedBy, createdAt }
```

Digər sxemlər: `Route`, `Bus`, `TripIntent` (Yanaşma A), `DensitySnapshot` (Yanaşma B), `User`/`OTP` (auth).

### Real-vaxt hadisələri (Socket.IO)

| Hadisə | Kimə | Məzmun |
|---|---|---|
| `buses:update` | hamıya | avtobus mövqeləri (2 san) |
| `crowd:update` | hamıya | xətt/avtobus/seqment sıxlığı |
| `density:update` | hamıya | canlı istifadəçilər (B) |
| `report:new` | hamıya | yeni crowdsourcing bildirişi |
| `demand:changed` | hamıya | «Gedirəm» niyyətləri dəyişdi (A) |
| `alert:new`, `alert:update` | **operators** otağı | xəbərdarlıq + tövsiyə |
| `dispatch:new` | **operators** otağı | yeni dispetçer əmri |
