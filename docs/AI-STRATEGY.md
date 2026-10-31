# AI inteqrasiya strategiyası — Smart Transit

Bu sənəd Smart Transit-də süni intellektin **harada**, **hansı modellə** və **nə üçün** istifadə olunduğunu təsvir edir. Əsas prinsip: **rəqəmləri riyazi/statistik modellər hesablayır, dil modelləri (LLM) isə izah edir, ünsiyyət qurur və əmr mətnini hazırlayır.** Son qərarı həmişə dispetçer verir.

---

## 1. Xülasə cədvəli

| İstifadə halı | Model tipi | Tövsiyə olunan model | Layihədə hazırkı vəziyyət | Kod |
|---|---|---|---|---|
| **Sıxlıq proqnozu** | Vaxt seriyası / cədvəl ML | Bazis: mövsümi orta + canlı düzəliş → LightGBM/XGBoost → Temporal Fusion Transformer | ✅ Bazis model işləyir | `server/services/ForecastService.js` |
| **ETA proqnozu** | Fizika + ML qalığı | Məsafə/sürət modeli → GBM ilə xəta düzəlişi | ✅ Fizika modeli (canlı GPS) | `server/services/EtaService.js` |
| **Smart Dispatcher Assistant** | Deterministik optimallaşdırma + LLM | Qayda/OR modeli + sürətli LLM (izah), güclü LLM (mürəkkəb hallar) | ✅ Tövsiyə + AI izahı + bir kliklə təsdiq | `DispatchService.js`, `AssistantService.js` |
| **Transit Chatbot** | LLM + tool calling | Sürətli, tool-calling dəstəkli LLM | ✅ Alətlərlə real-vaxt cavab; açarsız qayda rejimi | `AssistantService.chat()` |
| **Operator xülasəsi** | LLM | Sürətli LLM | ✅ Kontekst panelində | `AssistantService.routeSummary()` |
| **1–2 saatlıq proqnoz (Gemini)** | Statistik baza model + LLM mühakiməsi | Google **Gemini** (`gemini-3.5-flash`), strukturlu JSON cavab | ✅ Operator panelində «Gemini proqnozu» kartı; açarsız baza modeli | `PredictionService.js`, `GeminiService.js`, `GET /api/analytics/predict` |

Operator xülasəsi, tövsiyə izahı və chatbot üçün LLM çağırışları **OpenRouter** qatından keçir (`config.ai`), ona görə model `.env`-də dəyişdirilir, kod dəyişmir:

```env
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...            # sürətli model: xülasə + chatbot (tool calling)
OPENROUTER_REASONING_MODEL=...  # güclü model: dispetçer tövsiyəsinin izahı
```

> Model ID-ləri tez-tez dəyişir — cari siyahını və qiymətləri `openrouter.ai/models` səhifəsində yoxlayın. `google/gemini-2.0-flash-001` 1 iyun 2026-da söndürülüb; standart dəyər `google/gemini-3.5-flash`-dır.


Operator proqnozu isə birbaşa **Google Gemini API** ilə işləyir (`config.gemini`):

```env
GEMINI_API_KEY=...               # Google AI Studio açarı (yalnız server/.env)
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-flash-latest
```

### Gemini proqnozu necə işləyir

1. **Kontekst** (`PredictionService.gather`): 14 günlük crowdsourcing tarixçəsi (həftə günü × saat), tarixi pik saatlar, canlı sıxlıq və trend, aktiv xəbərdarlıqlar, park (avtobus, ehtiyat, interval), hava (Open-Meteo: yağış, külək, temperatur, növbəti 2 saatın yağış ehtimalı) və tıxac (real GPS göndərən avtobusların orta sürəti; GPS yoxdursa Bakı tıxac profili).
2. **Baza modeli** (`baseline`) həmişə hesablanır: mövsümi proqnoz + hava/tıxac düzəlişi → sıçrayışlar (≥95% doluluq və ya kəskin artım, ya da indi dolu olub sıx qalan xətlər) və yerdəyişmə (yaxın, az yüklü xəttdən və ya ehtiyat parkdan).
3. **Gemini** eyni konteksti və baza modelinin nəticəsini alır, `responseSchema` ilə strukturlu JSON qaytarır: xülasə, sıçrayışlar, yerdəyişmələr, risklər. Rəqəmləri yalnız data əsaslandırırsa dəyişə bilər.
4. **Server yoxlaması** (`sanitize`): naməlum xətlər, dublikatlar, özünə yerdəyişmə atılır; dəqiqə, faiz və avtobus sayı hədlərə salınır; donor xəttdə minimum avtobus qalır; mətnlər kəsilir. UI mətni HTML kimi yox, adi mətn kimi göstərir.
5. **Fallback və keş:** açar yoxdursa, Gemini xəta və ya boş cavab verərsə baza modeli qaytarılır (`source: "rules"`). Nəticə hər dil üçün 3 dəqiqə keşlənir; endpoint AI limiti ilə qorunur.

Gemini-yə şəxsi məlumat göndərilmir: cihaz ID, IP, koordinat yoxdur — yalnız xətt səviyyəsində aqreqatlar.

---

## 2. Proqnozlaşdırılan gözləmə vaxtı və sıxlıq (ETA & Density Prediction)

**Məqsəd:** növbəti 1–4 saatda hansı xətlərdə və hansı hissələrdə sıxlıq olacağını əvvəlcədən görmək; sərnişinə daha dəqiq gəliş vaxtı vermək.

### Model seçimi (mərhələli)

| Mərhələ | Model | Nə vaxt | Niyə |
|---|---|---|---|
| **0 — indi** | Həftə günü × saat üzrə tarixi orta + Bakı pik profili + cari canlı sapma | Data az olduqda (ilk həftələr) | Şəffaf, izah olunan, hesablaması ani, data olmadan da işləyir (prior) |
| **1** | **LightGBM / XGBoost** (kvantil reqressiya ilə) | ~4–8 həftə data yığıldıqdan sonra | Cədvəl tipli data üçün ən güclü və sürətli üsul; CPU-da millisaniyələr; xüsusiyyətlərin təsiri (SHAP) izah oluna bilir |
| **2** | **Temporal Fusion Transformer** və ya spatio-temporal **GNN** (xətlər/dayanacaqlar qrafı) | Bütün şəbəkə və aylarla data olduqda | Xətlər arası təsiri (köçürmə, paralel xətlər) və çoxsaatlıq horizontu birlikdə öyrənir |

**Niyə LLM deyil:** dil modelləri rəqəmsal zaman seriyalarında etibarlı deyil, bahadır və nəticəni izah etmək çətindir. Bu tapşırıq klassik ML işidir.

### Xüsusiyyətlər (features)
- Vaxt: saat, həftənin günü, bayram/məktəb tətili, xüsusi tədbirlər.
- Crowdsourcing: son 15/30/60 dəq-də sıxlıq balı, bildiriş sayı, GPS-təsdiq payı (`DensityReport`).
- **Yanaşma A**: növbəti 30 dəq üçün «Gedirəm» niyyətləri (`TripIntent`) — erkən siqnal.
- **Yanaşma B**: dayanacaqda gözləyən və avtobusda olan canlı istifadəçilər (`DensitySnapshot`).
- Əməliyyat: avtobus sayı, interval, ehtiyat avtobuslar, GPS sürəti (tıxac göstəricisi).
- Xarici: hava (yağış sıxlığı artırır), metro xətlərində nasazlıq.

### ETA
Hazırkı `EtaService` canlı GPS mövqeyi, istiqamət, qalan məsafə, orta sürət və dayanacaqda gözləmə üzərində hesablayır. Növbəti addım: bu fizika modelinin **xətasını** (real gəliş − proqnoz) GBM ilə öyrənmək. Belə hibrid model az datada da sabit qalır.

### Ölçülər
- ETA: MAE (saniyə), 90-cı persentil xəta.
- Sıxlıq: «Yüksək» sinfi üçün precision/recall/F1, 1 saat əvvəl proqnozun dəqiqliyi.
- Kalibrasiya: «etibar 70%» deyilən proqnozların ~70%-i düz çıxmalıdır.

---

## 3. Operator qərar dəstəyi (Smart Dispatcher Assistant)

**Məqsəd:** anomaliya yarananda (10 dəq ərzində «Yüksək») operatora **hansı xəttə neçə əlavə avtobus** buraxılmalı olduğunu tövsiyə etmək və əmri bir kliklə göndərmək.

### Arxitektura: deterministik nüvə + LLM izahı

```
Siqnallar (crowdsourcing, proqnoz, Yanaşma A, Yanaşma B, interval)
        │
        ▼
DispatchService.computeRecommendation()     ← RƏQƏM burada hesablanır (LLM yox)
  n' = ⌈ əsas avtobus sayı × doluluq / hədəf doluluq ⌉ + ⌈ niyyətlər / tətbiq payı / tutum ⌉
        │  {recommendedBuses, interval əvvəl→sonra, doluluq əvvəl→sonra, etibar, səbəblər}
        ▼
AssistantService.explainRecommendation()    ← LLM: 2–3 cümləlik izah + hazır əmr mətni (JSON)
        │  (rəqəmi dəyişməsi qadağandır — system prompt + server rəqəmi özü saxlayır)
        ▼
Operator: mətni redaktə edir → «Təsdiqlə» → DispatchCommand + ehtiyat avtobuslar xəttə
```

### Model seçimi
| Hissə | Model | Niyə |
|---|---|---|
| Avtobus sayı | Qayda əsaslı model (indi) → **OR-Tools / tam ədədli proqramlaşdırma** (depolar arası optimal bölgü) | Nəticə yoxlanıla bilən və təkrarlanan olmalıdır; məhdudiyyətlər (depo, sürücü, növbə) riyazi ifadə olunur |
| İzah + əmr mətni | **Claude Sonnet 5.5** kimi güclü model (`OPENROUTER_REASONING_MODEL`) | Çoxsaylı siqnalı ardıcıl əsaslandırır, AZ / EN / RU dillərində təbii mətn yazır (dil `Accept-Language`-dən gəlir), JSON formatına əməl edir |
| Qısa xülasə (kontekst paneli) | **Claude Haiku 5.5** və ya Gemini Flash sinfi sürətli model (`OPENROUTER_MODEL`) | Hər 2 dəqiqədən bir yenilənir — aşağı gecikmə və qiymət vacibdir |

### Qoruyucu qaydalar (guardrails)
- LLM **heç vaxt** avtobus sayını təyin etmir; server rəqəmi deterministik hesablayır və LLM cavabında dəyişdirilsə belə öz rəqəmini saxlayır.
- **Human-in-the-loop:** heç bir əmr operator təsdiqi olmadan göndərilmir.
- AI açarı yoxdursa və ya xəta olarsa, qayda əsaslı mətn göstərilir — panel işləməyə davam edir.
- Bütün əmrlər jurnala yazılır (`DispatchCommand.source = ai | manual`) — sonradan audit və modelin keyfiyyətini ölçmək üçün.

### Ölçülər
- Tövsiyənin qəbul faizi (operator dəyişmədən təsdiqləyir).
- Əmrdən sonra 15–30 dəq ərzində sıxlığın «Yüksək»dən düşmə faizi.
- Xəbərdarlıqdan əmrə qədər keçən vaxt (hədəf: < 1 dəq).

---

## 4. Sərnişin sual-cavab botu (Transit Chatbot)

**Məqsəd:** «A-dan B-yə necə gedim?», «Ən az sıx avtobus hansıdır?», «5 nömrəli avtobus sıxdır?» kimi suallara real-vaxt data əsasında cavab.

### Arxitektura: tool calling (RAG yox)
Cavab statik sənəddə deyil, **canlı sistemdədir**, ona görə model alətləri çağırır və nəticəni öz sözləri ilə izah edir:

| Alət | Nə qaytarır |
|---|---|
| `list_routes` | Xətlər və cari sıxlıq |
| `find_stops` | Ad üzrə dayanacaqlar |
| `route_status` | Xəttin sıxlığı, avtobus sayı, intervalı |
| `stop_arrivals` | Dayanacağa gələn avtobuslar (dəq) və sıxlığı |
| `plan_trip` | A→B marşrut variantları (`PlannerService`, «az sıxlıq» rejimi ilə) |

### Model seçimi
- **Əsas:** Claude Haiku 5.5 və ya Gemini Flash sinfi sürətli model — tool calling dəstəyi, Azərbaycan, rus və ingilis dillərində yaxşı nəticə, aşağı gecikmə (sərnişin 2–3 saniyədən çox gözləməməlidir) və hər sorğunun aşağı qiyməti.
- **Alternativ (məlumat suverenliyi):** öz serverində Llama ailəsindən açıq model. Lakin Azərbaycan dilində keyfiyyəti əvvəlcə real suallarla yoxlanmalıdır. Açarsız (qayda) rejimdə də cavablar üç dildədir.
- **Açarsız rejim:** qayda əsaslı cavab (dayanacaq adlarının tanınması + planlayıcı) — demo və nasazlıq zamanı.

### Qoruyucu qaydalar
- System prompt: yalnız nəqliyyat mövzusu, «bilmirəm» demək, rəqəm uydurmamaq.
- Rate limit (`aiRateLimiter`: 15 sorğu/dəq), son 10 mesaj, mesaj başına maks. 1000 simvol.
- Şəxsi məlumat göndərilmir (chatbot anonimdir).

---

## 5. Data və məxfilik

| Data | Saxlanma | Qeyd |
|---|---|---|
| `DensityReport` | 30 gün (TTL) | Anonim `deviceId`; proqnoz modelinin əsas datası |
| `TripIntent` (A) | 45 dəq (TTL) | Cihaz başına bir aktiv niyyət |
| Canlı lokasiya (B) | **Yalnız yaddaşda**, 90 san | Bazaya yazılmır |
| `DensitySnapshot` (B) | 7 gün (TTL) | Yalnız aqreqat saylar, fərdi koordinat yoxdur |
| LLM sorğuları | Saxlanmır | Provayderin data siyasəti yoxlanmalıdır (OpenRouter-də «no training» provayderləri seçilə bilər) |

---

## 6. Yol xəritəsi

1. **İndi:** bazis proqnoz, deterministik tövsiyə + LLM izahı, tool-calling chatbot (hamısı işləyir).
2. **1–2 ay:** real datanı toplamaq; ETA xətasını və «Yüksək» proqnozunun dəqiqliyini ölçmək; LightGBM-i ayrıca Python servisi (FastAPI) və ya ONNX modeli kimi `ForecastService`-in arxasına qoşmaq.
3. **3–6 ay:** depo/sürücü məhdudiyyətləri ilə OR-Tools optimallaşdırması; tövsiyənin qəbul faizinə görə qaydaları kalibrləmək.
4. **6+ ay:** şəbəkə səviyyəli TFT/GNN; hava və tədbir datası; A/B testi (AI izahı ilə və izahsız).
