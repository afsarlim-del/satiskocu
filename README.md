# Satış Koçu — Cloudflare Pages + Gemini/Groq

React (Vite) uygulaması + Cloudflare Pages Functions (anahtar gizli) + Cloudflare KV (global liderlik).
Tarayıcı → Pages Function → Gemini/Groq. Anahtar tarayıcıya HİÇ inmez.

## Yapı
- src/                          → uygulama (React)
- functions/api/claude.js       → AI proxy (Gemini, hata olursa Groq)
- functions/api/storage.js      → global depo (Cloudflare KV: SATISKOCU_KV)
- wrangler.toml                 → build çıktısı = dist
- package.json, vite.config.js, index.html

## Kurulum (GitHub + Cloudflare Pages)

### 1) Ücretsiz API anahtarları
- Gemini: aistudio.google.com/apikey → Create API key (kart gerekmez)
- (yedek) Groq: console.groq.com → API Keys → Create

### 2) Kodu GitHub'a koy
Bu klasörü bir GitHub deposuna yükle (mevcut repo da olur).

### 3) Cloudflare KV namespace oluştur (liderlik deposu)
- dash.cloudflare.com → soldan **Storage & Databases → KV** (ya da Workers & Pages > KV)
- **Create a namespace** → adı: `satiskocu` → oluştur.
- (Bu namespace'i birazdan projeye "SATISKOCU_KV" adıyla bağlayacağız.)

### 4) Cloudflare Pages projesi oluştur
- dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
- GitHub'ı yetkilendir, repoyu seç.
- Build ayarları:
  - Framework preset: **Vite** (yoksa "None")
  - Build command: `npm run build`
  - Build output directory: `dist`
- **Save and Deploy** de (ilk deploy anahtarsız olduğu için AI henüz çalışmayabilir; devam et).

### 5) Ortam değişkenlerini ekle
Pages projesi → **Settings → Variables and Secrets → Environment variables** (Production):
- `GEMINI_API_KEY` = (Gemini anahtarın)
- `GEMINI_MODEL` = `gemini-2.5-flash`
- `GROQ_API_KEY` = (Groq anahtarın) — opsiyonel ama önerilir
- `GROQ_MODEL` = `llama-3.3-70b-versatile`

### 6) KV namespace'i projeye bağla (ÖNEMLİ)
Pages projesi → **Settings → Functions → KV namespace bindings → Add binding**:
- Variable name: `SATISKOCU_KV`
- KV namespace: 3. adımda oluşturduğun `satiskocu`
- Kaydet.

### 7) Yeniden deploy et
Pages projesi → **Deployments → en üstteki deploy → Retry deployment** (ya da GitHub'a küçük bir commit at).
Değişkenler ve KV ancak yeniden deploy'da devreye girer.

### 8) Bitti
Cloudflare sana `https://satiskocu.pages.dev` gibi bir adres verir. Telefonda aç, "Ana Ekrana Ekle" yap.

## Notlar
- **Veri taşınmaz:** Netlify'daki eski liderlik verisi gelmez; Cloudflare'de sıfırdan başlar.
- **KV tutarlılığı:** Cloudflare KV yazımları küresel olarak birkaç saniyede yayılır; liderlik çok küçük gecikmeyle güncellenebilir (uygulama 20 sn'de bir zaten yeniliyor).
- **Yönetici paneli:** Profil → "Yönetici girişi" → kod 2024.
- **Ücretsiz katman:** Gemini/Groq limitlerine takılırsan kısa bekleyip tekrar dene; ikisi birlikte çoğu durumu karşılar.
- **Lokal test:** `npm install` sonra `npx wrangler pages dev -- npm run dev` (Functions + KV ile). Saf `npm run dev` Functions'ı çalıştırmaz.
