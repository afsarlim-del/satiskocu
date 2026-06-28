# Satış Koçu — Netlify + Gemini (Ücretsiz)

Anahtarı **sunucuda gizleyen**, liderlik tablosu **global** olan tam çalışan sürüm.
Yapay zekâ tarafı **Google Gemini'nin ücretsiz katmanı** ile çalışır.
Tarayıcı → Netlify Function → Gemini. Anahtar tarayıcıya HİÇ inmez.

> Maliyet: Netlify barındırma ücretsiz + Gemini ücretsiz katman = pratikte **bedava**
> (yalnızca ücretsiz katmanın günlük/dakikalık istek limitleri geçerli).

---

## Ne var?
- `src/App.jsx` — uygulama (prova, skorlama, liderlik, yönetici paneli, Excel, ses)
- `src/api.js` — çağrıları Netlify Function'lara yönlendirir
- `netlify/functions/claude.js` — **Gemini** proxy (anahtar burada, gizli)
- `netlify/functions/storage.js` — global depo (Netlify Blobs)
- `netlify.toml`, `package.json`, `vite.config.js`, `index.html`

---

## Kurulum

### 1) Ücretsiz Gemini anahtarı al
- **aistudio.google.com/apikey** adresine gir (Google hesabınla).
- **Create API key** de, anahtarı kopyala. (Kredi kartı gerekmez.)

### 2) Bu klasörü bir GitHub deposuna koy
- github.com'da yeni boş repo aç.
- `satiskocu` klasörünü yükle (web'den "upload files" ya da git push).

### 3) Netlify'a bağla
- app.netlify.com → **Add new site → Import an existing project** → GitHub → repoyu seç.
- Build ayarları otomatik gelir (netlify.toml): Build = npm run build, Publish = dist.
- **Deploy site** de.

### 4) Anahtarı ortam değişkenine ekle (ÖNEMLİ)
- Site settings → **Environment variables** → Add a variable:
  - Key: GEMINI_API_KEY
  - Value: (kopyaladığın anahtar)
- (opsiyonel) GEMINI_MODEL = gemini-2.0-flash
- Sonra **Deploys → Trigger deploy → Deploy site** ile yeniden yayınla.

### 5) Bitti
- Netlify sana bir adres verir (ör. https://satiskocu.netlify.app).
- Telefonda aç → kayıt ol → prova yap. "Ana Ekrana Ekle" dersen uygulama gibi açılır.

> Netlify Blobs (liderlik tablosu) ekstra kurulum istemez, deploy edilince otomatik aktif olur.

---

## Alternatif: Netlify CLI ile
    npm install -g netlify-cli
    cd satiskocu
    npm install
    netlify init
    netlify env:set GEMINI_API_KEY "senin-anahtarin"
    netlify deploy --build --prod

## Lokal test (isteğe bağlı)
    npm install
    netlify dev     # functions dahil lokal calisir (CLI gerekir)

`npm run dev` tek başına Function'ları çalıştırmaz; lokalde `netlify dev` kullan.

---

## Notlar
- **Ücretsiz katman limitleri:** Gemini'nin dakika/gün başına istek sınırı var; küçük ekip provası için genelde yeter. Sınıra takılırsan biraz bekleyip tekrar dene.
- **Güvenlik:** Anahtar yalnızca Netlify ortam değişkeninde durur, kullanıcıya gitmez. Adresi paylaşabilirsin.
- **Yönetici paneli:** Profil → "Yönetici girişi" → kod **2024**.
- **Ses:** En iyi Chrome/Android. Çalışmazsa müşteri baloncuğundaki 🔊 ile dene.
- **Model:** Daha kaliteli yanıt için GEMINI_MODEL = gemini-2.5-flash deneyebilirsin (ücretsiz katmanda mevcutsa).
- **Tailwind:** Hız için CDN ile geliyor (index.html). Sonra PostCSS'li kuruluma geçebilirsin.
