import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  Send, RotateCcw, Sparkles, Target, ShieldCheck, AlertCircle, Loader2,
  TrendingUp, MessageCircle, Flag, ArrowRight, LogOut, Trophy, Home as HomeIcon,
  Swords, User, ChevronRight, Zap, Crown, Dices, Mic, Volume2, VolumeX,
  Flame, Lightbulb, Users, BarChart3, BookOpen, Plus, ShieldAlert, CalendarDays, X, Check,
  Upload, Download, Activity, Wand2,
  Moon, Sun, ListChecks, ShoppingBag,
} from "lucide-react";
import * as XLSX from "xlsx";
import { callClaude, sget, sset, slist } from "./api.js";

const MODEL = "claude-sonnet-4-6";
const ADMIN_CODE = "2024";
const STORES = ["Kanyon", "Akasya", "Forum İstanbul", "İstinyePark", "Konya Kule", "Online"];

/* ====================== ses ====================== */
const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
let VOICES = [];
function loadVoices() { try { VOICES = (synth && synth.getVoices()) || []; } catch {} }
if (synth) { loadVoices(); try { synth.onvoiceschanged = loadVoices; } catch {} }
let _spkUnlocked = false;
function unlockSpeech() {
  if (!synth) return;
  loadVoices();
  if (_spkUnlocked) return;
  _spkUnlocked = true;
  try { const u = new SpeechSynthesisUtterance("​"); u.volume = 0; synth.speak(u); synth.resume(); } catch {}
}
if (typeof window !== "undefined") {
  const h = () => unlockSpeech();
  ["pointerdown", "touchstart", "click", "keydown"].forEach((ev) => window.addEventListener(ev, h, { passive: true }));
}
function speak(text, onDone, opts = {}) {
  if (!synth || !text) { onDone && onDone(); return; }
  try {
    synth.cancel();
    if (!VOICES.length) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    const v = opts.voice || VOICES.find((x) => (x.lang || "").toLowerCase().startsWith("tr")) || VOICES.find((x) => (x.lang || "").toLowerCase().startsWith("en"));
    if (v) u.voice = v;
    u.rate = opts.rate || 1.03;
    u.pitch = Math.max(0.4, Math.min(1.8, opts.pitch || 1));
    u.onend = () => onDone && onDone();
    u.onerror = () => onDone && onDone();
    synth.resume();
    synth.speak(u);
  } catch { onDone && onDone(); }
}
function charSeed(name) { let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) % 997; return h; }
const FEMALE_NAMES = ["selin", "elif", "aslı", "asli", "ayşe", "ayse", "burcu", "deniz", "zeynep", "eda", "seda", "merve", "buse", "ece", "yağmur", "yagmur", "gizem", "cansu", "derya", "esra", "büşra", "busra", "fatma", "hatice", "emine", "melek", "nur", "sıla", "sila", "irem", "öykü", "oyku", "su", "defne", "azra", "ela", "lara"];
function genderOf(name, explicit) {
  if (explicit === "k" || explicit === "e") return explicit;
  const n = String(name || "").toLowerCase().trim().split(" ")[0];
  if (FEMALE_NAMES.includes(n)) return "k";
  if (n.endsWith("a") || n.endsWith("e") && !["ahmet", "mehmet", "kerem"].includes(n)) return n.endsWith("a") ? "k" : "e";
  return "e";
}
function pickVoice(name, gender) {
  const tr = VOICES.filter((v) => (v.lang || "").toLowerCase().startsWith("tr"));
  const pool = tr.length ? tr : VOICES.filter((v) => (v.lang || "").toLowerCase().startsWith("en"));
  if (!pool.length) return null;
  const fem = /female|kadın|woman|yelda|filiz|seda|aylin|zeynep|google türkçe/i;
  const mal = /male|erkek|man|tolga|mesut|ahmet|murat/i;
  const want = gender === "k" ? fem : mal;
  const avoid = gender === "k" ? mal : fem;
  const matched = pool.filter((v) => want.test(v.name || "") && !avoid.test(v.name || ""));
  if (matched.length) return matched[charSeed(name) % matched.length];
  return pool[charSeed(name) % pool.length];
}
function voiceFor(emotion, name, gender) {
  const g = genderOf(name, gender);
  const gBase = g === "k" ? 1.18 : 0.88; // kadın daha tiz, erkek daha kalın
  const base = gBase + (charSeed(name) % 10) / 100;
  const m = {
    sinirli:   { rate: 1.13, pitch: base - 0.12 },
    tereddut:  { rate: 1.1,  pitch: base + 0.12 },
    supheci:   { rate: 0.97, pitch: base - 0.04 },
    dusunuyor: { rate: 0.95, pitch: base },
    ilgili:    { rate: 1.05, pitch: base + 0.05 },
    ikna:      { rate: 1.06, pitch: base + 0.1 },
  }[emotion] || { rate: 1.0, pitch: base };
  return { ...m, voice: pickVoice(name, g) };
}

/* ====================== kripto ====================== */
async function hashPin(u, p) { const d = new TextEncoder().encode(u.toLowerCase() + ":" + p + ":sk2"); const b = await crypto.subtle.digest("SHA-256", d); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
const ukey = (u) => "u:" + u.toLowerCase().trim();
const skey = (u) => "s:" + u.toLowerCase().trim();

function looseJSON(t) { const c = t.replace(/```json/gi, "").replace(/```/g, "").trim(); const s = c.indexOf("{"), e = c.lastIndexOf("}"); return JSON.parse(s >= 0 ? c.slice(s, e + 1) : c); }

const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const weekScore = (r) => (r.recent || []).filter((x) => Date.now() - x.ts < 7 * 864e5).reduce((s, x) => s + x.score, 0);

/* ====================== katalog ====================== */
const PRODUCTS = `GÜNCEL APPLE TÜRKİYE LİSTESİ (Mayıs 2026, başlangıç fiyatları):
iPhone: iPhone 17e 59.999₺ · iPhone 17 84.999₺ · iPhone Air 107.999₺ · iPhone 17 Pro 119.999₺ · iPhone 17 Pro Max 132.999₺ (2TB 188.999₺).
AirPods: AirPods 4 8.999₺ · AirPods Pro 3 15.499₺ · AirPods Max 2.
Apple Watch: Watch SE 3 15.499₺ · Watch Series 11 23.999₺ · Watch Ultra 3 65.999₺.
Mac/iPad: güncel M-serisi MacBook Air/Pro, iPad / iPad Air / iPad Pro.
Cihaz Sigortası: hasar/kaza koruması sunan ek paket.
Fiyatlar yaklaşık ve değişebilir; kesin fiyat apple.com.tr'dedir.`;

const DAILY_TASKS = [
  { id: "prova", emoji: "🎯", label: "1 prova tamamla", xp: 20 },
  { id: "capraz", emoji: "🔗", label: "3 çapraz satış öner", xp: 15 },
  { id: "sigorta", emoji: "🛡️", label: "1 müşteriye Cihaz Sigortası öner", xp: 15 },
  { id: "aksesuar", emoji: "🎧", label: "1 aksesuar ek satışı yap", xp: 15 },
  { id: "egitim", emoji: "📚", label: "Yeni ürün eğitimini gözden geçir", xp: 10 },
];
const OBJECTIONS = ["Çok pahalı", "Düşünüp geleceğim", "Teknosa'da daha ucuz", "Sigortaya gerek yok", "İnternetten alırım", "Eski telefonum yeterli"];

const DIFF = { kolay: { label: "Kolay", cls: "bg-emerald-100 text-emerald-700" }, orta: { label: "Orta", cls: "bg-amber-100 text-amber-700" }, zor: { label: "Zor", cls: "bg-rose-100 text-rose-700" } };

const BASE_CATALOG = [
  { id: "iph-ac", emoji: "📱", product: "iPhone 17", kpi: "Sigorta Attach", diff: "orta", name: "Kaan", mood: "supheci", brief: "İlk kez cihaz sigortası düşünüyor, 'ben düşürmem' diyor.", persona: "Sen Kaan, 34. Sahada çalışıyorsun, telefon hep elinde. cihaz sigortası'a mesafelisin. İtirazların: 'pahalı', 'gerek yok'. Onarım maliyeti + gönül rahatlığı somut anlatılırsa yumuşa; baskıda diren. Eşinin de kullanacağı çıkarsa ikna ol." },
  { id: "mac-up", emoji: "💻", product: "MacBook Air → Pro", kpi: "Mac Upgrade", diff: "zor", name: "Selin", mood: "dusunuyor", brief: "MacBook Air'a karar verdi ama işi Pro gerektirebilir.", persona: "Sen Selin, 29, video editörü. Air'a karar verdin, bütçen kısıtlı. İtirazların: 'Air yeter', 'Pro pahalı'. İş yükün (4K kurgu) öğrenilip Pro'nun zaman kazandırdığı rakamla anlatılırsa ikna olmaya başla; sadece 'daha güçlü' derse diren. Kolay ikna olma." },
  { id: "airpods", emoji: "🎧", product: "AirPods + aksesuar", kpi: "Aksesuar Attach", diff: "kolay", name: "Elif", mood: "ilgili", brief: "iPhone aldı, aksesuar düşünmüyor ama açık.", persona: "Sen Elif, 26. Yeni iPhone aldın, keyiflisin. Aksesuar düşünmedin ama açıksın. İtirazın hafif: 'sonra bakarım'. Spor/müzik alışkanlığın öğrenilip AirPods ona göre konumlandırılırsa hızlı ikna ol." },
  { id: "tradein", emoji: "🔄", product: "iPhone 13 takas", kpi: "Trade-In", diff: "orta", name: "Murat", mood: "dusunuyor", brief: "Eski telefonunu takas etmeyi düşünüyor ama tereddütlü.", persona: "Sen Murat, 41. iPhone 13'ünü vermeyi düşünüyorsun ama 'ikinci elde daha çok eder' diyorsun. İtirazın: 'takasta az veriyorlar'. Güvenlik, kolaylık, anlık indirim anlatılırsa ikna ol; geçiştirilirse vazgeç." },
  { id: "finance", emoji: "💳", product: "iPhone 17 Pro + taksit", kpi: "Finansman", diff: "orta", name: "Hakan", mood: "tereddut", brief: "Pro istiyor ama peşin fiyat gözünü korkutuyor.", persona: "Sen Hakan, 37. Pro istiyorsun ama peşin fiyat yüksek, vazgeçmek üzeresin. İtirazın: 'şu an bütçem yok'. Taksit aylık küçük tutara bölünüp fayda netleşirse ikna ol." },
  { id: "watch", emoji: "⌚", product: "Apple Watch", kpi: "Watch Attach", diff: "kolay", name: "Aslı", mood: "ilgili", brief: "Spora başladı, Watch'a sıcak bakıyor.", persona: "Sen Aslı, 31. Koşuya başladın, Watch merak ediyorsun ama 'telefonum var, gerek var mı' diyorsun. Nabız, koşu metrikleri, hedef takibi anlatılırsa hızlı ikna ol." },
  { id: "ipad", emoji: "✏️", product: "iPad + Pencil + Klavye", kpi: "iPad Attach", diff: "orta", name: "Deniz", mood: "dusunuyor", brief: "Öğrenci, sadece iPad düşünüyor; aksesuarsız.", persona: "Sen Deniz, 20, mimarlık öğrencisi. iPad istiyorsun, 'çıplak iPad yeter' diyorsun. İtirazın: 'öğrenci bütçesi'. Not + çizim ihtiyacın öğrenilip Pencil ve klavye gerekçelenirse ikna ol." },
  { id: "premium", emoji: "🏆", product: "iPhone + Mac + Koruma", kpi: "Premium Satış", diff: "zor", name: "Mehmet Bey", mood: "supheci", brief: "Pazarlıkçı işletme sahibi, çoklu cihaz alabilir.", persona: "Sen Mehmet Bey, 48, işletme sahibi. Kendine iPhone, ekibe Mac düşünüyorsun ama pazarlıkçı ve şüphecisin. İtirazların: 'indirim yok mu', 'koruma şart mı'. İşine somut katkı anlatılırsa açıl; özellik sayan temsilciye soğu. Zorlu pazarlık yap." },
  { id: "rakip", emoji: "🏷️", product: "iPhone 17 (fiyat itirazı)", kpi: "Sigorta Attach", diff: "zor", name: "Tolga", mood: "supheci", brief: "'Teknosa'da daha ucuz' diyerek geliyor.", persona: "Sen Tolga, 35. Telefonu başka yerde daha ucuz gördün ve bunu sürekli dile getiriyorsun: 'Teknosa'da indirimliydi'. İtirazların fiyat odaklı. Temsilci sadece fiyatı savunursa soğu; APR farkını (kurulum, güven, cihaz sigortası, hizmet) değer üzerinden anlatırsa yumuşa. Zorlu ol." },
  { id: "iade", emoji: "😤", product: "Şikâyet / iade", kpi: "İtiraz Yönetimi", diff: "zor", name: "Ayşe", mood: "sinirli", brief: "Önceki deneyimi kötü, sinirli ve dirençli.", persona: "Sen Ayşe, 44. Daha önce bir cihazda sorun yaşadın, sinirli ve güvensiz geldin. Önce şikâyet ediyorsun. Temsilci seni dinler, empati kurar ve çözüm sunarsa sakinleş; savunmaya geçer ya da geçiştirirse daha da sinirlen. Sakinleşirsen yeni alışverişe açıl." },
  { id: "lansman", emoji: "🚀", product: "iPhone 17 lansman", kpi: "Premium Satış", diff: "orta", name: "Can", mood: "ilgili", brief: "Lansman haftası, heyecanlı ama kararsız (Pro mu, normal mi).", persona: "Sen Can, 28. iPhone 17 lansmanında heyecanlısın ama Pro mu normal mi kararsızsın. İtirazın yok ama yönlendirilmek istiyorsun. İhtiyacın (kamera, oyun, saklama) keşfedilip doğru modele + korumaya yönlendirilirse hızlı ikna ol." },
  { id: "cr", emoji: "🚶", product: "Vitrin müşterisi", kpi: "Dönüşüm (CR)", diff: "orta", name: "Burcu", mood: "supheci", brief: "Sadece bakıyor, 'şöyle bir bakıyorum' diyor; çıkmak üzere.", persona: "Sen Burcu, 33. Sadece vitrine bakıyorsun, almaya niyetin belirsiz. Temsilci seni etiketlemeden ihtiyacını keşfeder ve değer gösterirse kal; ısrarcı/robotik olursa 'sağ olun bakıyorum' deyip çıkmaya yönel (leave:true)." },
  { id: "kapanis", emoji: "🤝", product: "iPhone 17 Pro (kararsız)", kpi: "Satış Kapatma", diff: "zor", name: "Okan", mood: "dusunuyor", brief: "Her şeyi beğendi ama bir türlü 'tamam' demiyor; kapatma tekniği şart.", persona: "Sen Okan, 38. Ürünü beğendin, soruların bitti ama karar vermekten kaçıyorsun: 'bir düşüneyim', 'belki sonra geçerim'. Gerçek bir itirazın yok, sadece kararsızsın ve oyalanıyorsun. KURAL: Temsilci zayıf kapatırsa (sadece 'buyrun isterseniz', 'düşünün') oyalan ve 'düşüneyim' deyip çık (leave:true). Ancak temsilci NET bir kapanış tekniği kullanırsa ikna ol ve al (done:true): varsayımsal kapanış ('paketleyeyim mi'), iki seçenekten birini sundurma ('256 mı 512 mi'), aciliyet/kıtlık ('bu renk son'), ya da özet + net çağrı. Lafı uzatıp kapatmayı denemeyen temsilciden sıkıl." },
];

const SCENARIO_SYSTEM = `Apple Premium Reseller (Türkiye) için GERÇEKÇİ ve HER SEFERİNDE FARKLI bir satış prova müşterisi üret. Kalıplaşma; klişe "merhaba, şöyle bakıyordum" açılışından KESİNLİKLE kaçın. İsim, yaş, cinsiyet, meslek, bütçe, kişilik ve konuşma tarzı benzersiz olsun. Ürün/fiyat verirsen şu güncel listeden seç:
${PRODUCTS}
SADECE JSON: {"name":"isim","gender":"e|k","product":"ürün","kpi":"Sigorta Attach|Aksesuar Attach|Mac Upgrade|Trade-In|Finansman|Watch Attach|iPad Attach|Premium Satış","diff":"kolay|orta|zor","brief":"tek cümle","mood":"supheci|dusunuyor|tereddut|ilgili|sinirli","emoji":"tek emoji","persona":"4-6 cümle, somut itirazlar ve bu kişiye özgü ayrıntılar dahil"}`;
const ARCHETYPES = ["fiyat odaklı sıkı pazarlıkçı", "teknolojiden anlamayan, ilk kez akıllı telefon alan", "rakip markaya (Android/Samsung) sadık, ikna olmaya kapalı", "bütçesi kısıtlı üniversite öğrencisi", "premium ve en yenisini isteyen üst gelirli", "çok kararsız, sürekli erteleyen", "internetten her şeyi araştırmış, fiyatları ezbere bilen bilinçli müşteri", "sevdiğine hediye almaya gelmiş, ürünü tanımayan", "garanti ve servis konusunda aşırı kaygılı", "yeniliğe meraklı, erken benimseyen teknoloji tutkunu", "yaşlı, sabırlı ve detaylı açıklama bekleyen", "küçük işletmesi için toplu/kurumsal alım soran", "acelesi olan, kısa ve net konuşan", "indirim/kampanya peşinde fırsatçı"];
const CONTEXTS = ["yoğun cumartesi kalabalığı", "sabahın sakin ilk saati", "büyük kampanya haftası", "yeni iPhone çıkış günü telaşı", "okula dönüş sezonu", "yılbaşı hediye yoğunluğu", "ay sonu bütçe kısıtlı dönem", "Black Friday günü"];
const OBJ_SEEDS = ["fiyat beklediğinden çok yüksek", "rakip mağazada/online daha ucuz gördü", "şimdi almak istemiyor, düşünecek", "eski cihazı hâlâ gayet iyi çalışıyor", "bu kadar özelliğe ihtiyacı olmadığını düşünüyor", "garanti/servis kapsamını yetersiz buluyor", "taksit/finansman koşullarını beğenmiyor", "istediği renk/model stokta yok sanıyor", "markaya güvenmiyor, kalıcılığından şüpheli", "eşine/patronuna danışması gerek"];
function scenarioSeed() {
  const r = (a) => a[Math.floor(Math.random() * a.length)];
  return `Bu sefer şu eksende, öncekilerden TAMAMEN farklı bir müşteri kurgula. Müşteri tipi: ${r(ARCHETYPES)}. Mağaza bağlamı: ${r(CONTEXTS)}. Baskın itiraz: ${r(OBJ_SEEDS)}. Bu profile uygun bir KPI ve zorluk seç; açılış cümlesi bu kişiliğe özgü, doğal ve klişe olmayan olsun.`;
}

const QUIZ = [
  { q: "cihaz sigortası teklifi için en doğru an hangisi?", a: ["Müşteri vitrindeyken", "İhtiyaç keşfinden sonra", "Ödeme bittikten sonra"], c: 1 },
  { q: "Yüksek attach için en etkili yaklaşım?", a: ["Fiyat vurgusu", "İhtiyaç + fayda eşleştirme", "İndirim sözü"], c: 1 },
  { q: "Trade-in müşteriye anında ne sağlar?", a: ["Anında indirim/kredi", "6 ay sonra ödeme", "Sadece geri dönüşüm"], c: 0 },
  { q: "Finansman itirazında doğru çerçeve?", a: ["Aylık küçük tutara bölmek", "Pahalı olduğunu kabul edip geçmek", "Konuyu değiştirmek"], c: 0 },
  { q: "Premium satışta işlem değerini artıran?", a: ["Tek ürün", "Paket + koruma", "Sadece kampanya"], c: 1 },
  { q: "Rakip 'daha ucuz' itirazında en iyi cevap?", a: ["Hemen fiyat kırmak", "Değer farkını (hizmet, güven, koruma) anlatmak", "Tartışmak"], c: 1 },
  { q: "Kararsız müşteriyi kapatmak için en etkili teknik?", a: ["Daha fazla özellik saymak", "İki seçenekten birini sundurmak", "Düşünmesi için yalnız bırakmak"], c: 1 },
  { q: "İhtiyaç keşfinde en değerli soru tipi?", a: ["Evet/hayır soruları", "Açık uçlu sorular", "Yönlendirici kapanış soruları"], c: 1 },
  { q: "Sinirli/şikâyetçi müşteride ilk adım?", a: ["Hemen savunmaya geçmek", "Dinleyip empati kurmak", "Başka ürün önermek"], c: 1 },
  { q: "AirPods çapraz satışı için en doğru an?", a: ["iPhone kararından sonra kullanım alışkanlığına göre", "Müşteri içeri girer girmez", "Kasada son anda"], c: 0 },
  { q: "Aksesuar attach'ında en ikna edici çerçeve?", a: ["'Herkes alıyor'", "Cihazı koruma + günlük fayda", "İndirim baskısı"], c: 1 },
  { q: "Watch satışında en güçlü konumlandırma?", a: ["Sadece bildirim", "Sağlık + spor hedef takibi", "Sadece şıklık"], c: 1 },
];

const MOODS = {
  supheci: { label: "Şüpheci", emoji: "😐", text: "text-slate-600", bg: "bg-slate-100" },
  dusunuyor: { label: "Düşünüyor", emoji: "🤔", text: "text-amber-700", bg: "bg-amber-50" },
  tereddut: { label: "Tereddüt ediyor", emoji: "😟", text: "text-orange-700", bg: "bg-orange-50" },
  ilgili: { label: "İlgili", emoji: "🙂", text: "text-emerald-700", bg: "bg-emerald-50" },
  ikna: { label: "İkna oldu", emoji: "😄", text: "text-emerald-800", bg: "bg-emerald-100" },
  sinirli: { label: "Sinirli", emoji: "😠", text: "text-rose-700", bg: "bg-rose-50" },
};
const AV_COLORS = ["bg-indigo-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-fuchsia-500", "bg-teal-500"];

function levelInfo(xp = 0) {
  const per = 600, level = Math.floor(xp / per) + 1, into = xp - (level - 1) * per;
  const titles = ["Çırak", "Çırak", "Danışman", "Danışman", "Uzman", "Uzman", "Kıdemli", "Kıdemli", "Usta Koç"];
  return { level, pct: Math.round((into / per) * 100), into, per, title: titles[Math.min(level - 1, titles.length - 1)], nextXp: per - into };
}
function streakMult(streak) { return streak >= 7 ? 1.5 : streak >= 3 ? 1.2 : 1; }
function daysBetween(a, b) { if (!a) return 999; const d1 = new Date(a + "T00:00:00"), d2 = new Date(b + "T00:00:00"); return Math.round((d2 - d1) / 864e5); }
function applyStreak(rec, today) {
  const gap = daysBetween(rec.lastPlayedDate, today);
  if (gap === 0) return;
  if (gap === 1) rec.streak = (rec.streak || 0) + 1;
  else { const missed = gap - 1; if ((rec.freezes || 0) >= missed) { rec.freezes = (rec.freezes || 0) - missed; rec.streak = (rec.streak || 0) + 1; } else rec.streak = 1; }
  rec.lastPlayedDate = today;
}
const FREEZE_COST = 150;
const BADGES = [
  { id: "first", emoji: "🎯", label: "İlk Prova", cond: (r) => r.sessions >= 1 },
  { id: "five", emoji: "🔥", label: "5 Prova", cond: (r) => r.sessions >= 5 },
  { id: "ten", emoji: "🏃", label: "Maraton", cond: (r) => r.sessions >= 10 },
  { id: "master", emoji: "⭐", label: "Usta 90+", cond: (r) => r.bestScore >= 90 },
  { id: "streak", emoji: "🔥", label: "3 Gün Seri", cond: (r) => (r.streak || 0) >= 3 },
  { id: "versatile", emoji: "🧭", label: "Çok Yönlü", cond: (r) => Object.keys(r.perKpi || {}).length >= 3 },
];

const SEED = [
  { username: "Ahmet", bestScore: 94, sessions: 28, totalXp: 2240, color: "bg-indigo-500", store: "Kanyon", kpis: ["Sigorta Attach", "Mac Upgrade", "Finansman", "Premium Satış"] },
  { username: "Emre", bestScore: 91, sessions: 21, totalXp: 1760, color: "bg-rose-500", store: "Akasya", kpis: ["Sigorta Attach", "Trade-In", "Aksesuar Attach"] },
  { username: "Zeynep", bestScore: 89, sessions: 17, totalXp: 1380, color: "bg-violet-500", store: "Kanyon", kpis: ["Watch Attach", "iPad Attach"] },
  { username: "Burak", bestScore: 85, sessions: 12, totalXp: 940, color: "bg-amber-500", store: "İstinyePark", kpis: ["Mac Upgrade", "Finansman"] },
  { username: "Eda", bestScore: 82, sessions: 9, totalXp: 700, color: "bg-emerald-500", store: "Akasya", kpis: ["Sigorta Attach", "Watch Attach"] },
];
async function seedIfNeeded() {
  if (await sget("seed:v3", true)) return;
  const keys = await slist("s:");
  if (keys.length < 4) for (const s of SEED) {
    const perKpi = {}, realByKpi = {}; s.kpis.forEach((k) => { perKpi[k] = { best: s.bestScore - Math.floor(Math.random() * 8), sessions: Math.ceil(s.sessions / s.kpis.length) }; realByKpi[k] = { actual: 12 + Math.floor(Math.random() * 16), target: 25 }; });
    const ra = Object.values(realByKpi); const am = Math.round(ra.reduce((x, y) => x + y.actual, 0) / ra.length);
    await sset(skey(s.username), { username: s.username, bestScore: s.bestScore, sessions: s.sessions, totalXp: s.totalXp, perKpi, realByKpi, avatarColor: s.color, store: s.store, recent: Array.from({ length: 6 }, (_, i) => ({ score: 70 + Math.floor(Math.random() * 25), kpi: s.kpis[0], ts: Date.now() - i * 864e5 })), outcomes: { won: Math.round(s.sessions * 0.6), lost: Math.round(s.sessions * 0.2) }, realKpi: { actual: am, target: 25 }, seeded: true });
  }
  await sset("seed:v3", { at: Date.now() }, true);
}

/* ====================== uygulama ====================== */
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [tab, setTab] = useState("home");
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [board, setBoard] = useState([]);
  const [manager, setManager] = useState(false);
  const [custom, setCustom] = useState([]);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("sk-theme") || "light"; } catch { return "light"; } });
  const catalog = useMemo(() => [...BASE_CATALOG, ...custom], [custom]);
  useEffect(() => { try { localStorage.setItem("sk-theme", theme); } catch {} }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  useEffect(() => { (async () => {
    await seedIfNeeded();
    setCustom((await sget("cscn:list")) || []);
    const sess = await sget("session", false);
    if (sess && sess.username) { const rec = await sget(ukey(sess.username)); if (rec) { setManager(!!sess.manager); await load(sess.username); setScreen("app"); return; } }
    setScreen("auth");
  })(); }, []);

  // Canlı liderlik: düzenli yenile + ilgili sekmeye geçince yenile
  useEffect(() => {
    if (screen !== "app" || !user) return;
    const id = setInterval(() => { load(user.username); }, 20000);
    return () => clearInterval(id);
  }, [screen, user && user.username]);
  useEffect(() => {
    if (screen === "app" && user && (tab === "home" || tab === "board" || tab === "mgr")) load(user.username);
  }, [tab]);

  async function load(username) {
    setUser({ username });
    setMe(await sget(skey(username)));
    const keys = await slist("s:");
    const recs = (await Promise.all(keys.map((k) => sget(k)))).filter(Boolean);
    recs.sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0));
    setBoard(recs);
    setCustom((await sget("cscn:list")) || []);
  }
  async function onAuthed(username) { await sset("session", { username }, false); await load(username); setScreen("app"); setTab("home"); }
  async function logout() { await sset("session", {}, false); setUser(null); setMe(null); setManager(false); setScreen("auth"); }
  async function becomeManager() { setManager(true); await sset("session", { username: user.username, manager: true }, false); }

  if (screen === "loading") return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;
  if (screen === "auth") return <div className={theme === "dark" ? "sk-dark" : ""}><Style /><Auth onAuthed={onAuthed} /></div>;

  const myRank = board.findIndex((b) => b.username.toLowerCase() === user.username.toLowerCase()) + 1;
  const reload = () => load(user.username);

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 antialiased ${theme === "dark" ? "sk-dark" : ""}`}>
      <Style />
      <div className="mx-auto max-w-md px-4 pb-24 pt-5">
        <TopBar user={user} me={me} onLogout={logout} manager={manager} theme={theme} onToggleTheme={toggleTheme} />
        {tab === "home" && <HomeTab user={user} me={me} board={board} myRank={myRank} catalog={catalog} onBoard={() => setTab("board")} onLaunch={(sc) => { window.__launch = sc; setTab("play"); }} onUpdate={reload} />}
        {tab === "play" && <PracticeTab user={user} catalog={catalog} onFinish={reload} goHome={() => setTab("home")} />}
        {tab === "coach" && <CoachTab user={user} onUpdate={reload} />}
        {tab === "board" && <LeaderboardTab board={board} user={user} />}
        {tab === "profile" && <ProfileTab me={me} user={user} myRank={myRank} manager={manager} onBecomeManager={becomeManager} onUpdate={reload} />}
        {tab === "mgr" && manager && <ManagerTab board={board} catalog={catalog} reload={reload} />}
      </div>
      <BottomNav tab={tab} setTab={setTab} manager={manager} />
    </div>
  );
}

function Style() { return <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes popIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}.fade-up{animation:fadeUp .3s ease both}.pop-in{animation:popIn .3s ease both}@keyframes skBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}@keyframes skTalk{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1.05)}}@keyframes skBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes skWave{0%,100%{opacity:.3}50%{opacity:1}}@keyframes skThink{0%,100%{opacity:.4}50%{opacity:1}}.sk-eyes{transform-box:fill-box;transform-origin:center;animation:skBlink 4.2s infinite}.sk-talk{transform-box:fill-box;transform-origin:center;animation:skTalk .24s infinite}.sk-bob{animation:skBob 3.6s ease-in-out infinite}.sk-wave{animation:skWave .9s ease-in-out infinite}.sk-think{animation:skThink 1.1s ease-in-out infinite}.sk-dark{color-scheme:dark}.sk-dark .bg-slate-50{background-color:#0b1220!important}.sk-dark .bg-white{background-color:#1e293b!important}.sk-dark .bg-slate-100{background-color:#334155!important}.sk-dark .bg-slate-200{background-color:#475569!important}.sk-dark .text-slate-900{color:#f1f5f9!important}.sk-dark .text-slate-800{color:#e2e8f0!important}.sk-dark .text-slate-700{color:#cbd5e1!important}.sk-dark .text-slate-600{color:#cbd5e1!important}.sk-dark .text-slate-500{color:#94a3b8!important}.sk-dark .text-slate-400{color:#94a3b8!important}.sk-dark .ring-slate-200{--tw-ring-color:#334155!important}.sk-dark .ring-slate-100{--tw-ring-color:#334155!important}.sk-dark .border-slate-200,.sk-dark .border-slate-100{border-color:#334155!important}.sk-dark .bg-indigo-50{background-color:#312e81!important}.sk-dark .bg-emerald-50{background-color:#064e3b!important}.sk-dark .bg-amber-50{background-color:#422006!important}.sk-dark .bg-rose-50{background-color:#4c0519!important}.sk-dark .bg-orange-50{background-color:#431407!important}.sk-dark .bg-emerald-100{background-color:#065f46!important}.sk-dark .bg-amber-100{background-color:#78350f!important}.sk-dark .bg-rose-100{background-color:#881337!important}.sk-dark .bg-emerald-50,.sk-dark .bg-amber-50,.sk-dark .bg-rose-50,.sk-dark .bg-orange-50,.sk-dark .bg-indigo-50{--tw-ring-color:#475569!important}.sk-dark .border-t{border-color:#334155!important}` }} />; }

const FACE = {
  supheci:   { browL: "M36 47 L52 51", browR: "M68 51 L84 47", mouth: "M48 86 Q60 85 72 86", blush: 0,   sweat: false, happy: false },
  dusunuyor: { browL: "M36 45 L52 48", browR: "M68 51 L84 54", mouth: "M52 86 Q60 84 68 86", blush: 0,   sweat: false, happy: false },
  tereddut:  { browL: "M36 52 L52 45", browR: "M68 45 L84 52", mouth: "M48 90 Q60 83 72 90", blush: 0,   sweat: true,  happy: false },
  ilgili:    { browL: "M36 46 L52 47", browR: "M68 47 L84 46", mouth: "M48 84 Q60 92 72 84", blush: 0.5, sweat: false, happy: false },
  ikna:      { browL: "M36 44 L52 45", browR: "M68 45 L84 44", mouth: "M44 82 Q60 99 76 82", blush: 0.9, sweat: false, happy: true },
  sinirli:   { browL: "M36 43 L52 52", browR: "M68 52 L84 43", mouth: "M48 92 Q60 84 72 92", blush: 0,   sweat: false, happy: false },
};
function CharacterFace({ mood = "supheci", talking, thinking, female }) {
  const f = FACE[mood] || FACE.supheci;
  const lookUp = thinking || mood === "dusunuyor";
  const px = lookUp ? -1.5 : 0, py = lookUp ? -3 : 0;
  return (
    <svg viewBox="0 0 130 142" className="h-full w-full">
      <defs>
        <radialGradient id="skin" cx="50%" cy="40%" r="62%"><stop offset="0%" stopColor="#ffe9d2" /><stop offset="100%" stopColor="#f4c193" /></radialGradient>
        <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4b4b55" /><stop offset="100%" stopColor="#2c2c34" /></linearGradient>
        <radialGradient id="glow" cx="50%" cy="44%" r="60%"><stop offset="0%" stopColor="#fff" stopOpacity=".55" /><stop offset="100%" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="65" cy="62" rx="54" ry="58" fill="url(#glow)" />
      <path d="M16 142 Q16 108 65 108 Q114 108 114 142 Z" fill="#6366f1" />
      <path d="M40 112 Q65 126 90 112 L90 142 L40 142 Z" fill="#4f46e5" />
      <path d="M57 109 L65 119 L73 109" fill="none" stroke="#c7d2fe" strokeWidth="2.5" />
      <rect x="56" y="93" width="18" height="18" rx="7" fill="#f1bf94" />
      {female && (<g fill="url(#hair)"><path d="M22 56 Q14 96 26 112 Q30 96 28 70 Z" /><path d="M108 56 Q116 96 104 112 Q100 96 102 70 Z" /></g>)}
      <circle cx="26" cy="66" r="7" fill="url(#skin)" /><circle cx="104" cy="66" r="7" fill="url(#skin)" />
      <ellipse cx="65" cy="64" rx="40" ry="42" fill="url(#skin)" />
      <path d="M24 62 Q24 16 65 16 Q106 16 106 62 Q106 42 88 38 Q76 30 65 30 Q54 30 42 38 Q24 42 24 62 Z" fill="url(#hair)" />
      <ellipse cx="44" cy="78" rx="7.5" ry="4.5" fill="#fb7185" opacity={female ? Math.max(0.35, f.blush) : f.blush} />
      <ellipse cx="86" cy="78" rx="7.5" ry="4.5" fill="#fb7185" opacity={female ? Math.max(0.35, f.blush) : f.blush} />
      {f.happy ? (
        <g stroke="#2c2c34" strokeWidth="3.5" strokeLinecap="round" fill="none"><path d="M43 65 Q51 58 59 65" /><path d="M71 65 Q79 58 87 65" /></g>
      ) : (
        <g className="sk-eyes">
          <ellipse cx="51" cy="65" rx="7" ry="8.5" fill="#fff" /><circle cx={51 + px} cy={66 + py} r="3.4" fill="#27272a" />
          <ellipse cx="79" cy="65" rx="7" ry="8.5" fill="#fff" /><circle cx={79 + px} cy={66 + py} r="3.4" fill="#27272a" />
          {female && (<g stroke="#27272a" strokeWidth="1.4" strokeLinecap="round"><path d="M44 60 l-3 -2" /><path d="M58 60 l3 -2" /><path d="M72 60 l-3 -2" /><path d="M86 60 l3 -2" /></g>)}
        </g>
      )}
      <path d={f.browL} stroke="#2c2c34" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d={f.browR} stroke="#2c2c34" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      {talking
        ? <g><ellipse className="sk-talk" cx="65" cy="90" rx="9" ry="7" fill="#7f1d1d" /><ellipse cx="65" cy="92" rx="4" ry="2.4" fill="#ef9a9a" /></g>
        : <path d={f.mouth} stroke="#7f1d1d" strokeWidth="4" strokeLinecap="round" fill="none" />}
      {f.sweat && <path className="sk-wave" d="M99 46 q4 7 0 10 a4 4 0 1 1 0 -10 z" fill="#7dd3fc" />}
      {talking && <g className="sk-wave" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" fill="none"><path d="M97 82 q5 8 0 16" /><path d="M105 78 q8 12 0 24" /></g>}
      {thinking && <g className="sk-think"><circle cx="101" cy="34" r="3.2" fill="#cbd5e1" /><circle cx="110" cy="27" r="2.4" fill="#cbd5e1" /><circle cx="117" cy="21" r="1.7" fill="#cbd5e1" /></g>}
    </svg>
  );
}

function TopBar({ user, me, onLogout, manager, theme, onToggleTheme }) {
  const lv = levelInfo(me?.totalXp || 0);
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600"><Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} /></div><div><div className="text-[15px] font-bold leading-tight tracking-tight">Satış Koçu</div><div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{manager ? "Yönetici · Panel" : `Lv ${lv.level} · ${lv.title}`}</div></div></div>
      <div className="flex items-center gap-2">
        <button onClick={onToggleTheme} title="Tema" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
        <button onClick={onLogout} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">{user.username} <LogOut className="h-3 w-3 text-slate-400" /></button>
      </div>
    </div>
  );
}
function Avatar({ name, color = "bg-indigo-500", size = "h-9 w-9", text = "text-sm" }) { return <div className={`flex ${size} shrink-0 items-center justify-center rounded-full ${color} ${text} font-bold text-white`}>{(name || "?").slice(0, 2).toUpperCase()}</div>; }

function Auth({ onAuthed }) {
  const [mode, setMode] = useState("login"), [u, setU] = useState(""), [pin, setPin] = useState(""), [store, setStore] = useState(STORES[0]), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit() {
    setErr(""); const un = u.trim();
    if (un.length < 2) return setErr("Kullanıcı adı en az 2 karakter.");
    if (!/^\d{4,6}$/.test(pin)) return setErr("Şifre 4-6 haneli rakam olmalı.");
    setBusy(true);
    try {
      const ex = await sget(ukey(un)), h = await hashPin(un, pin);
      if (mode === "register") {
        if (ex) { setErr("Bu ad alınmış."); setBusy(false); return; }
        await sset(ukey(un), { username: un, pinHash: h, createdAt: Date.now() });
        if (!(await sget(skey(un)))) await sset(skey(un), { username: un, bestScore: 0, sessions: 0, totalXp: 0, perKpi: {}, realByKpi: {}, recent: [], store, outcomes: { won: 0, lost: 0 }, avatarColor: AV_COLORS[un.length % AV_COLORS.length] });
        await onAuthed(un);
      } else {
        if (!ex) { setErr("Kullanıcı yok. Önce kayıt ol."); setBusy(false); return; }
        if (ex.pinHash !== h) { setErr("Şifre hatalı."); setBusy(false); return; }
        await onAuthed(un);
      }
    } catch { setErr("Sorun oluştu, tekrar dene."); }
    setBusy(false);
  }
  return (
    <div className="min-h-screen bg-slate-50 font-sans"><div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-8 text-center fade-up"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md"><Sparkles className="h-8 w-8 text-white" strokeWidth={2} /></div><h1 className="text-2xl font-bold tracking-tight">Satış Koçu</h1><p className="mt-1 text-sm text-slate-500">Pratik yap, skorlan, liderlik tablosunda yüksel.</p></div>
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 fade-up">
        <div className="mb-4 flex rounded-xl bg-slate-100 p-1 text-sm font-semibold"><button onClick={() => { setMode("login"); setErr(""); }} className={`flex-1 rounded-lg py-2 ${mode === "login" ? "bg-white shadow-sm" : "text-slate-500"}`}>Giriş</button><button onClick={() => { setMode("register"); setErr(""); }} className={`flex-1 rounded-lg py-2 ${mode === "register" ? "bg-white shadow-sm" : "text-slate-500"}`}>Kayıt</button></div>
        <div className="space-y-3">
          <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Kullanıcı adı" className="w-full rounded-xl bg-slate-50 px-3.5 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-indigo-500" />
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode="numeric" placeholder="Şifre (4-6 rakam)" onKeyDown={(e) => e.key === "Enter" && submit()} className="w-full rounded-xl bg-slate-50 px-3.5 py-3 text-sm tracking-widest outline-none ring-1 ring-slate-200 focus:ring-indigo-500" />
          {mode === "register" && <select value={store} onChange={(e) => setStore(e.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-indigo-500">{STORES.map((s) => <option key={s}>{s}</option>)}</select>}
        </div>
        {err && <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {err}</div>}
        <button onClick={submit} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white hover:opacity-95 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{mode === "login" ? "Giriş yap" : "Hesabı oluştur"}</button>
        <p className="mt-4 text-center text-[11px] text-slate-400">MVP erişimi · şifre cihazda hash'lenir</p>
      </div>
    </div></div>
  );
}

function convPct(me) { const w = me?.outcomes?.won || 0, l = me?.outcomes?.lost || 0; return w + l ? Math.round((w / (w + l)) * 100) + "%" : "—"; }
function Stat({ label, value, accent }) { return <div className={`rounded-2xl px-3 py-3.5 text-center ring-1 ${accent ? "bg-indigo-50 ring-indigo-100" : "bg-white ring-slate-200"}`}><div className={`text-xl font-bold tracking-tight ${accent ? "text-indigo-700" : ""}`}>{value}</div><div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div></div>; }

function HomeTab({ user, me, board, myRank, catalog, onBoard, onLaunch, onUpdate }) {
  const lv = levelInfo(me?.totalXp || 0);
  const top3 = board.slice(0, 3);
  const daily = catalog[new Date().getDate() % catalog.length];
  const dailyDone = me?.dailyDone === todayStr();
  const hw = me?.homework ? catalog.find((s) => s.id === me.homework.scenarioId) : null;
  const today = todayStr();
  const taskDone = me?.daily && me.daily.date === today ? me.daily.done || {} : {};
  const doneCount = Object.keys(taskDone).length;
  async function completeTask(t) {
    if (taskDone[t.id]) return;
    const rec = await sget(skey(user.username)); if (!rec) return;
    const d = rec.daily && rec.daily.date === today ? rec.daily : { date: today, done: {} };
    if (!d.done[t.id]) { d.done[t.id] = true; rec.totalXp = (rec.totalXp || 0) + t.xp; }
    rec.daily = d; await sset(skey(user.username), rec); onUpdate && onUpdate();
  }
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-5 text-white shadow-xl fade-up">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-indigo-500/30 blur-2xl" /><div className="pointer-events-none absolute -bottom-14 -left-8 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
        <div className="relative flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Seviye {lv.level} · {lv.title}</div><div className="mt-1 text-3xl font-bold tracking-tight">{me?.bestScore || 0}<span className="ml-1 text-sm font-medium text-slate-400">en iyi</span></div></div><div className="space-y-1 text-right"><div className="flex items-center justify-end gap-1 text-amber-300"><Zap className="h-4 w-4" /><span className="text-lg font-bold">{me?.totalXp || 0}</span></div><div className="flex items-center justify-end gap-1 text-orange-300"><Flame className="h-3.5 w-3.5" /><span className="text-xs font-bold">{me?.streak || 0} gün</span></div></div></div>
        <div className="relative mt-4"><div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>Lv {lv.level}</span><span>{lv.nextXp} XP kaldı</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${lv.pct}%` }} /></div></div>
        <div className="relative mt-3 flex items-center gap-2 text-[11px] font-bold"><span className="rounded-full bg-white/10 px-2.5 py-1 text-amber-200">🪙 {me?.coins || 0}</span><span className="rounded-full bg-white/10 px-2.5 py-1 text-sky-200">🧊 {me?.freezes || 0}</span>{streakMult(me?.streak || 0) > 1 && <span className="rounded-full bg-orange-500/30 px-2.5 py-1 text-orange-200">🔥 ×{streakMult(me?.streak || 0)} puan</span>}</div>
      </div>

      {hw && <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 fade-up"><div className="flex items-center gap-2.5"><span className="text-xl">{hw.emoji}</span><div><div className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Yöneticinden ödev</div><div className="text-sm font-semibold text-amber-900">{hw.kpi}</div></div></div><button onClick={() => onLaunch(hw)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">Başla</button></div>}

      <button onClick={() => !dailyDone && onLaunch({ ...daily, daily: true })} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 fade-up ${dailyDone ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-white ring-1 ring-slate-200 hover:ring-indigo-300"}`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dailyDone ? "bg-emerald-100" : "bg-indigo-50"}`}>{dailyDone ? <Check className="h-5 w-5 text-emerald-600" /> : <CalendarDays className="h-5 w-5 text-indigo-600" />}</div><div className="text-left"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Günün Provası {!dailyDone && "· +30 XP"}</div><div className="text-sm font-bold">{dailyDone ? "Bugün tamamlandı 🎉" : `${daily.emoji} ${daily.kpi}`}</div></div></div>{!dailyDone && <ArrowRight className="h-5 w-5 text-slate-400" />}</button>

      <div className="grid grid-cols-3 gap-3"><Stat label="Sıralama" value={myRank ? "#" + myRank : "—"} accent /><Stat label="Prova" value={me?.sessions || 0} /><Stat label="Dönüşüm" value={convPct(me)} /></div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 fade-up">
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-indigo-600" /> Günlük Görevler</div><span className="text-[11px] font-semibold text-slate-400">{doneCount}/{DAILY_TASKS.length}</span></div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${(doneCount / DAILY_TASKS.length) * 100}%` }} /></div>
        <div className="space-y-2">{DAILY_TASKS.map((t) => { const done = !!taskDone[t.id]; return (
          <button key={t.id} onClick={() => completeTask(t)} disabled={done} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ${done ? "bg-emerald-50 ring-emerald-200" : "bg-slate-50 ring-slate-200 hover:ring-indigo-300"}`}>
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? "bg-emerald-500 text-white" : "bg-white ring-1 ring-slate-300"}`}>{done && <Check className="h-3.5 w-3.5" />}</div>
            <span className="text-base">{t.emoji}</span>
            <span className={`flex-1 text-[13px] font-medium ${done ? "text-emerald-700 line-through" : "text-slate-700"}`}>{t.label}</span>
            <span className={`text-[11px] font-bold ${done ? "text-emerald-600" : "text-amber-600"}`}>+{t.xp}</span>
          </button>); })}</div>
        {doneCount === DAILY_TASKS.length && <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[12px] font-bold text-emerald-700 ring-1 ring-emerald-200">Tüm görevler bitti, harikasın! 🎉</div>}
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 fade-up"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-bold"><Trophy className="h-4 w-4 text-amber-500" /> Liderlik</div><button onClick={onBoard} className="flex items-center text-xs font-semibold text-indigo-600">Tümü <ChevronRight className="h-3.5 w-3.5" /></button></div><div className="space-y-1.5">{top3.map((r, i) => <Row key={r.username} r={r} i={i} myName={user.username} />)}</div></div>
    </div>
  );
}

const Row = memo(function Row({ r, i, myName, metric = "bestScore" }) {
  const mine = r.username.toLowerCase() === (myName || "").toLowerCase();
  const medal = ["🥇", "🥈", "🥉"]; const lv = levelInfo(r.totalXp || 0);
  const val = metric === "week" ? weekScore(r) : (r[metric] || 0);
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${mine ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white" : "bg-slate-50"}`}>
      <div className="flex items-center gap-2.5"><span className="w-6 text-center text-sm font-bold">{i < 3 ? medal[i] : i + 1}</span><Avatar name={r.username} color={mine ? "bg-white/20" : r.avatarColor} size="h-8 w-8" text="text-xs" /><div><div className="text-sm font-semibold">{r.username}{mine && " (sen)"}</div><div className={`text-[11px] ${mine ? "text-indigo-200" : "text-slate-400"}`}>Lv {lv.level} · {r.store || "—"}</div></div></div>
      <div className="text-lg font-bold">{val}</div>
    </div>
  );
});

function LeaderboardTab({ board, user }) {
  const [metric, setMetric] = useState("bestScore"); const [teams, setTeams] = useState(false);
  const sorted = useMemo(() => [...board].sort((a, b) => (metric === "week" ? weekScore(b) - weekScore(a) : (b[metric] || 0) - (a[metric] || 0))), [board, metric]);
  const teamRows = useMemo(() => { const g = {}; board.forEach((r) => { const s = r.store || "Atanmamış"; g[s] = g[s] || { store: s, xp: 0, members: 0 }; g[s].xp += r.totalXp || 0; g[s].members++; }); return Object.values(g).sort((a, b) => b.xp - a.xp); }, [board]);
  const top3 = sorted.slice(0, 3), rest = sorted.slice(3), podOrder = [1, 0, 2];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold tracking-tight">Liderlik</h1><div className="flex rounded-xl bg-slate-100 p-1 text-[11px] font-semibold">{[["bestScore", "Skor"], ["totalXp", "XP"], ["week", "Hafta"]].map(([m, l]) => <button key={m} onClick={() => { setMetric(m); setTeams(false); }} className={`rounded-lg px-2.5 py-1.5 ${!teams && metric === m ? "bg-white shadow-sm" : "text-slate-500"}`}>{l}</button>)}<button onClick={() => setTeams(true)} className={`rounded-lg px-2.5 py-1.5 ${teams ? "bg-white shadow-sm" : "text-slate-500"}`}>Takım</button></div></div>
      {teams ? (
        <div className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-slate-200">{teamRows.map((t, i) => <div key={t.store} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"><div className="flex items-center gap-2.5"><span className="w-6 text-center font-bold">{["🥇", "🥈", "🥉"][i] || i + 1}</span><div><div className="text-sm font-bold">{t.store}</div><div className="text-[11px] text-slate-400">{t.members} satıcı</div></div></div><div className="text-right"><div className="text-lg font-bold text-indigo-600">{t.xp}</div><div className="text-[10px] text-slate-400">toplam XP</div></div></div>)}</div>
      ) : (<>
        {top3.length >= 3 && <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 px-4 pb-4 pt-6 fade-up"><div className="flex items-end justify-center gap-3">{podOrder.map((idx) => { const r = top3[idx]; if (!r) return null; const h = idx === 0 ? "h-24" : idx === 1 ? "h-16" : "h-12"; const ring = idx === 0 ? "ring-amber-400" : idx === 1 ? "ring-slate-300" : "ring-orange-400"; const mine = r.username.toLowerCase() === user.username.toLowerCase(); const val = metric === "week" ? weekScore(r) : (r[metric] || 0); return <div key={r.username} className="flex flex-1 flex-col items-center pop-in">{idx === 0 && <Crown className="mb-1 h-5 w-5 text-amber-400" />}<Avatar name={r.username} color={r.avatarColor} size="h-12 w-12" text="text-sm" /><div className="mt-1.5 max-w-full truncate text-xs font-bold text-white">{r.username}{mine && " ★"}</div><div className="text-[11px] font-semibold text-amber-300">{val}</div><div className={`mt-2 flex w-full items-start justify-center rounded-t-lg bg-white/10 pt-1 ring-1 ${ring} ${h}`}><span className="text-base font-bold text-white/80">{idx + 1}</span></div></div>; })}</div></div>}
        <div className="space-y-1.5 rounded-2xl bg-white p-3 ring-1 ring-slate-200">{sorted.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Henüz skor yok.</p>}{(top3.length >= 3 ? rest : sorted).map((r, i) => <Row key={r.username} r={r} i={top3.length >= 3 ? i + 3 : i} myName={user.username} metric={metric} />)}</div>
      </>)}
    </div>
  );
}

function ProfileTab({ me, user, myRank, manager, onBecomeManager, onUpdate }) {
  const lv = levelInfo(me?.totalXp || 0);
  const earned = BADGES.map((b) => ({ ...b, got: b.cond(me || {}) }));
  const kpis = Object.entries(me?.perKpi || {});
  const recent = (me?.recent || []).slice(-8);
  const [code, setCode] = useState(""), [showCode, setShowCode] = useState(false), [cerr, setCerr] = useState("");
  const [buying, setBuying] = useState(false);
  const coins = me?.coins || 0, freezes = me?.freezes || 0, mult = streakMult(me?.streak || 0);
  async function buyFreeze() {
    if (buying) return; setBuying(true);
    try { const rec = await sget(skey(user.username)); if (rec && (rec.coins || 0) >= FREEZE_COST) { rec.coins -= FREEZE_COST; rec.freezes = (rec.freezes || 0) + 1; await sset(skey(user.username), rec); onUpdate && onUpdate(); } } catch {}
    setBuying(false);
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 fade-up">
        <div className="flex items-center gap-4"><Avatar name={user.username} color={me?.avatarColor} size="h-16 w-16" text="text-xl" /><div><div className="text-lg font-bold">{user.username}</div><div className="text-sm font-semibold text-indigo-600">Lv {lv.level} · {lv.title}</div><div className="text-xs text-slate-400">#{myRank || "—"} · {me?.store || "—"} · 🔥{me?.streak || 0} gün</div></div></div>
        <div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>{me?.totalXp || 0} XP</span><span>Lv {lv.level + 1}'e {lv.nextXp} XP</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${lv.pct}%` }} /></div></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]"><div className="rounded-xl bg-amber-50 py-2"><div className="text-base font-bold text-amber-600">🪙 {coins}</div><div className="text-slate-400">Jeton</div></div><div className="rounded-xl bg-sky-50 py-2"><div className="text-base font-bold text-sky-600">🧊 {freezes}</div><div className="text-slate-400">Dondurucu</div></div><div className="rounded-xl bg-orange-50 py-2"><div className="text-base font-bold text-orange-600">🔥 ×{mult}</div><div className="text-slate-400">Çarpan</div></div></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><div className="text-lg font-bold text-emerald-600">{me?.outcomes?.won || 0}</div><div className="text-[10px] text-slate-400">Kazanılan</div></div><div><div className="text-lg font-bold text-rose-500">{me?.outcomes?.lost || 0}</div><div className="text-[10px] text-slate-400">Kaybedilen</div></div><div><div className="text-lg font-bold text-indigo-600">{convPct(me)}</div><div className="text-[10px] text-slate-400">Dönüşüm</div></div></div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 p-4 ring-1 ring-sky-100">
        <div className="flex items-center gap-2 text-sm font-bold"><ShoppingBag className="h-4 w-4 text-sky-600" /> Mağaza</div>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="text-3xl">🧊</div>
          <div className="flex-1"><div className="text-[13px] font-bold">Seri Dondurucu</div><div className="text-[11px] text-slate-500">Bir günü kaçırsan bile serini korur. Loss aversion'a karşı kalkanın.</div></div>
          <button onClick={buyFreeze} disabled={coins < FREEZE_COST || buying} className="shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 px-3 py-2 text-[12px] font-bold text-white disabled:opacity-40">{buying ? "…" : `🪙 ${FREEZE_COST}`}</button>
        </div>
        {coins < FREEZE_COST && <div className="mt-2 text-[11px] text-slate-400">Prova, demo ve quizlerle jeton kazan; {FREEZE_COST - coins} jeton kaldı.</div>}
      </div>
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 text-sm font-bold">Rozetler</div><div className="grid grid-cols-3 gap-2.5">{earned.map((b) => <div key={b.id} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center ${b.got ? "bg-amber-50 ring-1 ring-amber-100" : "bg-slate-50 opacity-40"}`}><span className="text-2xl">{b.emoji}</span><span className="text-[10px] font-semibold leading-tight text-slate-600">{b.label}</span></div>)}</div></div>
      {kpis.length > 0 && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 text-sm font-bold">KPI Bazında En İyi</div><div className="space-y-2.5">{kpis.map(([k, v]) => <div key={k}><div className="mb-1 flex justify-between text-[13px]"><span className="font-medium text-slate-600">{k}</span><span className="font-bold">{v.best}</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, v.best)}%` }} /></div></div>)}</div></div>}
      {recent.length > 0 && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 text-sm font-bold">Son Provalar</div><div className="flex items-end gap-2">{recent.map((s, i) => <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="flex w-full items-end justify-center" style={{ height: 56 }}><div className="w-full max-w-[26px] rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-500" style={{ height: `${Math.max(6, (s.score / 100) * 56)}px` }} /></div><span className="text-[11px] font-semibold text-slate-500">{s.score}</span></div>)}</div></div>}
      {!manager && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">{!showCode ? <button onClick={() => setShowCode(true)} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500"><ShieldAlert className="h-4 w-4" /> Yönetici girişi</button> : <div className="space-y-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Yönetici kodu" className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200" />{cerr && <p className="text-xs text-rose-600">{cerr}</p>}<button onClick={() => { if (code === ADMIN_CODE) onBecomeManager(); else setCerr("Kod hatalı."); }} className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white">Panele gir</button></div>}</div>}
    </div>
  );
}

/* ====================== prova ====================== */
function PracticeTab({ user, catalog, onFinish, goHome }) {
  const [view, setView] = useState("pick"); const [scenario, setScenario] = useState(null); const [genBusy, setGenBusy] = useState(false); const [feedback, setFeedback] = useState(null);
  useEffect(() => { if (window.__launch) { setScenario(window.__launch); setView("play"); window.__launch = null; } }, []);
  async function genAI() { setGenBusy(true); try { const s = looseJSON(await callClaude(SCENARIO_SYSTEM, [{ role: "user", content: scenarioSeed() }])); s.id = "ai-" + Date.now(); setScenario(s); setView("play"); } catch { setScenario(catalog[Math.floor(Math.random() * catalog.length)]); setView("play"); } setGenBusy(false); }
  if (view === "quiz") return <Quiz user={user} onDone={() => { onFinish(); setView("pick"); }} onBack={() => setView("pick")} />;
  if (view === "guided") return <GuidedDemo user={user} onBack={() => { onFinish(); setView("pick"); }} />;
  if (view === "play" && scenario) return <Roleplay user={user} scenario={scenario} onResult={(fb) => { setFeedback(fb); setView("result"); onFinish(); }} onQuit={() => setView("pick")} />;
  if (view === "result" && feedback) return <Result fb={feedback} scenario={scenario} onAgain={() => setView("pick")} onHome={goHome} />;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold tracking-tight">Senaryo seç</h1><p className="text-sm text-slate-500">Müşteri seç, yapay zekâ üretsin, rehberli demoyu izle ya da quiz çöz.</p></div>
      <button onClick={() => setView("guided")} className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-800 px-4 py-4 text-left text-white shadow-md"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Sparkles className="h-6 w-6" /></div><div className="flex-1"><div className="text-[14px] font-bold">Rehberli Demo · 2-3 dk</div><div className="text-[11px] text-indigo-200">Canlı bir görüşmeyi izle; danışmanı seçeneklerle sen yönlendir.</div></div><ArrowRight className="h-5 w-5 text-indigo-200" /></button>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={genAI} disabled={genBusy} className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 px-4 py-3.5 text-left text-white disabled:opacity-60"><Dices className="h-5 w-5 shrink-0" /><div><div className="text-[13px] font-bold">AI senaryo</div><div className="text-[10px] text-indigo-200">benzersiz</div></div>{genBusy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}</button>
        <button onClick={() => setView("quiz")} className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-3.5 text-left text-white"><BookOpen className="h-5 w-5 shrink-0" /><div><div className="text-[13px] font-bold">Bilgi Quizi</div><div className="text-[10px] text-emerald-100">akıllı · +XP</div></div></button>
      </div>
      <div className="grid grid-cols-2 gap-3">{catalog.map((s) => <button key={s.id} onClick={() => { setScenario(s); setView("play"); }} className="flex flex-col items-start rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:shadow-md hover:ring-indigo-300"><div className="flex w-full items-center justify-between"><span className="text-2xl">{s.emoji}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF[s.diff].cls}`}>{DIFF[s.diff].label}</span></div><div className="mt-2 text-[13px] font-bold leading-tight">{s.kpi}</div><div className="mt-0.5 text-[11px] text-slate-400">{s.product}</div><div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500"><User className="h-3 w-3" /> {s.name}{s.custom && <span className="ml-1 rounded bg-indigo-50 px-1 text-[9px] text-indigo-600">özel</span>}</div></button>)}</div>
    </div>
  );
}

function FaceG({ x = 0, y = 0, s = 1, skin = "#fadcc0", hair = "#2c2c34", shirt = "#6366f1", mood = "ilgili", talking, pupil = 0, badge, female }) {
  const f = FACE[mood] || FACE.ilgili;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M8 150 Q8 104 65 104 Q122 104 122 150 Z" fill={shirt} />
      <path d="M40 108 Q65 122 90 108 L90 150 L40 150 Z" fill="#000" opacity=".08" />
      <rect x="56" y="92" width="18" height="16" rx="7" fill={skin} />
      {badge && <rect x="86" y="120" width="16" height="11" rx="2" fill="#ffffff" />}
      {badge && <rect x="88" y="123" width="12" height="2.2" rx="1" fill="#cbd5e1" />}
      {female && (<g fill={hair}><path d="M23 54 Q15 98 27 116 Q31 98 29 68 Z" /><path d="M107 54 Q115 98 103 116 Q99 98 101 68 Z" /></g>)}
      <circle cx="27" cy="64" r="7" fill={skin} /><circle cx="103" cy="64" r="7" fill={skin} />
      <ellipse cx="65" cy="62" rx="39" ry="41" fill={skin} />
      <path d="M25 60 Q25 16 65 16 Q105 16 105 60 Q105 40 87 37 Q75 30 65 30 Q55 30 43 37 Q25 40 25 60 Z" fill={hair} />
      {(f.blush > 0 || female) && (<g><ellipse cx="45" cy="76" rx="7" ry="4" fill="#fb7185" opacity={female ? Math.max(0.35, f.blush) : f.blush} /><ellipse cx="85" cy="76" rx="7" ry="4" fill="#fb7185" opacity={female ? Math.max(0.35, f.blush) : f.blush} /></g>)}
      {f.happy ? (
        <g stroke="#2c2c34" strokeWidth="3.5" strokeLinecap="round" fill="none"><path d="M44 64 Q51 57 58 64" /><path d="M72 64 Q79 57 86 64" /></g>
      ) : (
        <g className="sk-eyes">
          <ellipse cx="51" cy="64" rx="6.5" ry="8" fill="#fff" /><circle cx={51 + pupil} cy="65" r="3.2" fill="#27272a" />
          <ellipse cx="79" cy="64" rx="6.5" ry="8" fill="#fff" /><circle cx={79 + pupil} cy="65" r="3.2" fill="#27272a" />
          {female && (<g stroke="#27272a" strokeWidth="1.3" strokeLinecap="round"><path d="M44 59 l-3 -2" /><path d="M58 59 l3 -2" /><path d="M72 59 l-3 -2" /><path d="M86 59 l3 -2" /></g>)}
        </g>
      )}
      <path d={f.browL} stroke="#2c2c34" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d={f.browR} stroke="#2c2c34" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      {talking ? <ellipse className="sk-talk" cx="65" cy="89" rx="8" ry="6" fill="#7f1d1d" /> : <path d={f.mouth} stroke="#7f1d1d" strokeWidth="3.6" strokeLinecap="round" fill="none" />}
      {f.sweat && <path className="sk-wave" d="M99 46 q4 7 0 10 a4 4 0 1 1 0 -10 z" fill="#7dd3fc" />}
    </g>
  );
}
function StoreScene({ mood = "supheci", custTalk, advTalk, female }) {
  return (
    <svg viewBox="0 0 360 212" className="h-full w-full">
      <defs>
        <linearGradient id="ssSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfe9ff" /><stop offset="1" stopColor="#eef7ff" /></linearGradient>
        <linearGradient id="ssFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecd9bb" /><stop offset="1" stopColor="#dec59c" /></linearGradient>
      </defs>
      <rect x="0" y="0" width="360" height="152" fill="#eef2f7" />
      <rect x="18" y="16" width="150" height="86" rx="6" fill="url(#ssSky)" stroke="#cbd5e1" strokeWidth="3" />
      <g fill="#bcd6ec"><rect x="30" y="62" width="16" height="40" /><rect x="52" y="50" width="14" height="52" /><rect x="72" y="68" width="18" height="34" /><rect x="96" y="56" width="14" height="46" /><rect x="118" y="70" width="16" height="32" /><rect x="140" y="58" width="14" height="44" /></g>
      <line x1="93" y1="16" x2="93" y2="102" stroke="#cbd5e1" strokeWidth="2" /><line x1="18" y1="59" x2="168" y2="59" stroke="#cbd5e1" strokeWidth="2" />
      <g><rect x="196" y="24" width="150" height="8" rx="3" fill="#dfe5ec" /><rect x="196" y="56" width="150" height="8" rx="3" fill="#dfe5ec" />
        {[210, 236, 262, 288, 314].map((x, i) => <rect key={i} x={x} y="34" width="18" height="18" rx="3" fill={["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa"][i]} />)}
        {[210, 236, 262, 288, 314].map((x, i) => <rect key={"b" + i} x={x} y="66" width="18" height="18" rx="3" fill={["#f87171", "#22d3ee", "#c084fc", "#4ade80", "#fb923c"][i]} />)}
      </g>
      <g fill="#fde68a" opacity=".5"><ellipse cx="120" cy="5" rx="34" ry="5" /><ellipse cx="250" cy="5" rx="34" ry="5" /></g>
      <rect x="0" y="152" width="360" height="60" fill="url(#ssFloor)" />
      <g stroke="#d3b88f" strokeWidth="1.5"><line x1="0" y1="170" x2="360" y2="170" /><line x1="0" y1="192" x2="360" y2="192" /></g>
      <g><rect x="20" y="118" width="20" height="28" rx="3" fill="#b08968" /><path d="M30 118 Q16 94 28 90 Q32 102 30 118" fill="#3f9d6b" /><path d="M30 118 Q44 94 32 90 Q28 102 30 118" fill="#34875a" /><path d="M30 116 Q30 90 38 88 Q36 102 30 116" fill="#4caf7a" /></g>
      <g className="sk-bob"><FaceG x={42} y={40} s={0.8} skin="#f1c79c" hair="#3a3a42" shirt="#4f46e5" mood="ilgili" talking={advTalk} pupil={2} badge female /></g>
      <FaceG x={210} y={52} s={0.92} skin="#f6cfa0" hair="#2c2c34" shirt="#94a3b8" mood={mood} talking={custTalk} pupil={-2} female={female} />
      <g><rect x="92" y="156" width="176" height="40" rx="6" fill="#ffffff" /><rect x="88" y="150" width="184" height="11" rx="4" fill="#caa97c" /><rect x="150" y="134" width="15" height="22" rx="3" fill="#1f2937" /><rect x="205" y="140" width="26" height="16" rx="3" fill="#334155" /></g>
    </svg>
  );
}
function GuidedDemo({ user, onBack }) {
  const [hist, setHist] = useState([]); // {customer, mood, options, picked, quality, why}
  const [cur, setCur] = useState(null); // {customer, mood, options}
  const [mood, setMood] = useState("supheci"); const [busy, setBusy] = useState(true); const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null); const [done, setDone] = useState(false); const [verdict, setVerdict] = useState(""); const [err, setErr] = useState(""); const [custTalk, setCustTalk] = useState(false);
  const apiRef = useRef([]);
  useEffect(() => { if (cur && cur.customer) { setCustTalk(true); speak(cur.customer, () => setCustTalk(false), voiceFor(cur.mood, cur.name || "Müşteri", cur.gender)); } }, [cur]);
  useEffect(() => () => { try { synth && synth.cancel(); } catch {} }, []);
  const sys = `Sen Apple Premium Reseller (Türkiye) için bir satış EĞİTMENİsin. Kullanıcıya rehberli bir vaka oynatıyorsun: müşteri konuşur, sen DANIŞMAN için 3 olası cevap sunarsın (biri "iyi", biri "orta", biri "zayıf"; sırayı karıştır). Kullanıcı birini seçer, müşteri ona göre tepki verir. Gerçekçi ve kısa tut.
${PRODUCTS}
SADECE JSON: {"customer":"müşterinin cümlesi (1-2 cümle)","name":"müşteri adı","gender":"e|k","mood":"supheci|dusunuyor|tereddut|ilgili|ikna|sinirli","options":[{"text":"danışman cevabı","quality":"iyi|orta|zayıf","why":"tek cümle gerekçe"}],"closed":false,"verdict":""}`;
  async function step1() {
    setBusy(true); setErr("");
    const msgs = [{ role: "user", content: `Vakaya başla. ${scenarioSeed()} İlk müşteri cümlesini, adını, cinsiyetini ve 3 danışman seçeneğini ver.` }];
    try { const r = looseJSON(await callClaude(sys, msgs)); apiRef.current = [...msgs, { role: "assistant", content: JSON.stringify(r) }]; setCur(r); setMood(r.mood || "supheci"); } catch { setErr("Demo başlatılamadı, geri dönüp tekrar dene."); }
    setBusy(false);
  }
  useEffect(() => { step1(); }, []);
  async function pick(opt) {
    if (picked !== null || busy) return; setPicked(opt);
    setHist((h) => [...h, { ...cur, picked: opt.text, quality: opt.quality, why: opt.why }]);
    const nextStep = step + 1; setStep(nextStep);
    const closing = nextStep >= 5;
    const msgs = [...apiRef.current, { role: "user", content: `Danışman şu cevabı seçti: "${opt.text}" (kalite: ${opt.quality}). Müşterinin buna tepkisini ver.${closing ? ' Bu son tur: "closed":true yap ve "verdict" alanında 2-3 cümlelik kısa genel değerlendirme + tek somut tavsiye yaz.' : " Yeni durumu ve 3 yeni danışman seçeneğini ver."}` }];
    setBusy(true);
    try {
      const r = looseJSON(await callClaude(sys, msgs)); apiRef.current = [...msgs, { role: "assistant", content: JSON.stringify(r) }];
      setTimeout(() => {
        setMood(r.mood || mood); setPicked(null);
        if (r.closed || closing) { setVerdict(r.verdict || "Görüşme tamamlandı."); setDone(true); (async () => { try { const rec = await sget(skey(user.username)); if (rec) { rec.totalXp = (rec.totalXp || 0) + 40; rec.coins = (rec.coins || 0) + 20; await sset(skey(user.username), rec); } } catch {} })(); }
        else setCur(r);
        setBusy(false);
      }, 900);
    } catch { setErr("Yanıt alınamadı, tekrar seç."); setPicked(null); setBusy(false); }
  }
  const QCLS = { iyi: "ring-emerald-300 bg-emerald-50", orta: "ring-amber-300 bg-amber-50", zayıf: "ring-rose-300 bg-rose-50" };
  if (done) return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-semibold text-slate-500">← Geri</button>
      <div className="rounded-2xl bg-white p-5 text-center ring-1 ring-slate-200 pop-in"><div className="overflow-hidden rounded-2xl ring-1 ring-slate-200"><div className="aspect-[360/212] w-full bg-slate-100"><StoreScene mood="ikna" /></div></div><div className="mt-3 text-lg font-bold">Demo tamamlandı</div></div>
      <Block tone="indigo" icon={<Sparkles className="h-4 w-4" />} title="Eğitmen değerlendirmesi" items={[verdict]} />
      <button onClick={onBack} className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white">Bitir</button>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><button onClick={onBack} className="text-sm font-semibold text-slate-500">← Geri</button><span className="text-xs font-semibold text-slate-400">Adım {Math.min(step + 1, 5)}/5</span></div>
      <div className="overflow-hidden rounded-3xl shadow-sm ring-1 ring-slate-200"><div className="aspect-[360/212] w-full bg-slate-100"><StoreScene mood={mood} custTalk={custTalk} advTalk={busy && picked !== null} female={cur && genderOf(cur.name, cur.gender) === "k"} /></div></div>
      <div className="-mt-1 flex items-center justify-center gap-2 text-[12px] font-semibold"><span className="text-slate-400">Müşteri:</span><span className={MOODS[mood]?.text}>{MOODS[mood]?.label}</span></div>
      {err && <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> {err}</div>}
      {busy && !cur ? <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /><p className="mt-3 text-sm text-slate-500">Görüşme hazırlanıyor…</p></div> : cur && (<>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-[14px] leading-relaxed text-slate-800">💬 {cur.customer}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Danışman ne demeli?</div>
        <div className="space-y-2">{(cur.options || []).map((o, idx) => { const showQ = picked !== null; const cls = showQ ? (QCLS[o.quality] || "ring-slate-200 bg-slate-50") : "ring-slate-200 bg-white hover:ring-indigo-300"; return (
          <button key={idx} onClick={() => pick(o)} disabled={picked !== null || busy} className={`w-full rounded-xl px-4 py-3 text-left text-[13px] font-medium ring-1 transition ${cls} disabled:opacity-90`}>
            <div className="flex items-start gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="flex-1">{o.text}</span>{showQ && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${o.quality === "iyi" ? "bg-emerald-200 text-emerald-800" : o.quality === "orta" ? "bg-amber-200 text-amber-800" : "bg-rose-200 text-rose-800"}`}>{o.quality}</span>}</div>
            {showQ && picked === o && <div className="mt-1.5 pl-6 text-[12px] text-slate-600">{o.why}</div>}
          </button>); })}</div>
        {busy && picked !== null && <div className="flex items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> müşteri tepki veriyor…</div>}
      </>)}
    </div>
  );
}


function buildCustomerSystem(s) {
  return `Sen bir Apple Premium Reseller mağazasında (Türkiye) alışveriş yapan GERÇEKÇİ bir müşterisin.
${s.persona}
${PRODUCTS}
Ürün adı/fiyatından söz ederken SADECE yukarıdaki güncel listeyi kullan; uydurma model ya da fiyat verme.
KURALLAR: Asla satıcı gibi davranma, sadece müşteri ol. Kısa konuş (1-3 cümle). Baskıya diren, iyi keşif+somut faydaya yumuşa. Yeterince ikna olursan satın al: "done":true. Kötü yönetilirsen ya da senaryon gerektiriyorsa vazgeçip çık: "leave":true.
Ruh halini içeriğe göre seç: kızgın/şikâyetçiysen "sinirli", endişeli/kararsızsan "tereddut", ısınıyorsan "ilgili", ikna olduysan "ikna".
Her yanıtında SADECE JSON: {"reply":"...","emotion":"ilgili|dusunuyor|tereddut|supheci|ikna|sinirli","done":false,"leave":false}`;
}

function Roleplay({ user, scenario, onResult, onQuit }) {
  const [turns, setTurns] = useState([]); const [mood, setMood] = useState(scenario.mood || "supheci"); const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false); const [scoring, setScoring] = useState(false); const [ended, setEnded] = useState(null);
  const [err, setErr] = useState(""); const [ready, setReady] = useState(false); const [voiceMode, setVoiceMode] = useState(false); const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(""); const [hintBusy, setHintBusy] = useState(false);
  const [talking, setTalking] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const ref = useRef(null), recogRef = useRef(null), apiRef = useRef([]), voiceRef = useRef(false), endedRef = useRef(false), thinkingRef = useRef(false), talkTimer = useRef(null);
  function pulseTalk(ms = 1400) { setTalking(true); if (talkTimer.current) clearTimeout(talkTimer.current); talkTimer.current = setTimeout(() => setTalking(false), ms); }
  function sayOut(text, then, emotion) { setTalking(true); speak(text, () => { setTalking(false); then && then(); }, voiceFor(emotion || mood, scenario.name, scenario.gender)); }
  useEffect(() => { const last = turns[turns.length - 1]; if (last && last.who === "c" && !synth) pulseTalk(Math.min(4500, 900 + (last.text ? last.text.length : 0) * 38)); }, [turns]);
  useEffect(() => { voiceRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { endedRef.current = !!ended; }, [ended]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);
  useEffect(() => { (async () => {
    const msgs = [{ role: "user", content: "(Sahne başlıyor. Müşteri olarak doğal bir açılış cümlesi söyle.)" }];
    let op;
    try { const raw = await callClaude(buildCustomerSystem(scenario), msgs); const p = looseJSON(raw); apiRef.current = [...msgs, { role: "assistant", content: raw }]; op = { text: p.reply, emotion: p.emotion || scenario.mood }; setTurns([{ who: "c", text: op.text, emotion: op.emotion }]); setMood(op.emotion); }
    catch { apiRef.current = msgs; op = { text: "Merhaba, biraz bakınıyordum.", emotion: scenario.mood }; setTurns([{ who: "c", text: op.text, emotion: op.emotion }]); }
    setReady(true);
    setTimeout(() => sayOut(op.text, undefined, op.emotion), 300);
  })(); }, []);
  useEffect(() => () => { try { synth && synth.cancel(); } catch {} try { recogRef.current && recogRef.current.stop(); } catch {} }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [turns, thinking]);

  async function doSend(text) {
    const t = (text || "").trim(); if (!t || thinkingRef.current || endedRef.current) return;
    setInput(""); setErr(""); setHint(""); setTurns((x) => [...x, { who: "r", text: t }]);
    const msgs = [...apiRef.current, { role: "user", content: t }]; apiRef.current = msgs; setThinking(true); thinkingRef.current = true;
    try {
      const raw = await callClaude(buildCustomerSystem(scenario), msgs); const p = looseJSON(raw);
      apiRef.current = [...msgs, { role: "assistant", content: raw }];
      setTurns((x) => [...x, { who: "c", text: p.reply, emotion: p.emotion }]); setMood(p.emotion || mood);
      if (p.done) { setEnded("won"); endedRef.current = true; } else if (p.leave) { setEnded("lost"); endedRef.current = true; }
      sayOut(p.reply, () => { if (voiceRef.current && !endedRef.current) startListen(true); }, p.emotion);
    } catch { setErr("Yanıt alınamadı, tekrar gönder."); }
    setThinking(false); thinkingRef.current = false;
  }
  async function getHint() {
    if (hintBusy || endedRef.current) return; setHintBusy(true);
    const tr = turns.map((t) => (t.who === "r" ? "Temsilci: " : "Müşteri: ") + t.text).join("\n");
    try { const h = await callClaude(`Sen bir satış koçusun. KPI: ${scenario.kpi}. Konuşmaya bakıp temsilciye SADECE tek cümlelik uygulanabilir taktik ipucu ver. Tırnak yok.`, [{ role: "user", content: tr || "(henüz konuşma yok)" }]); setHint(h.trim().slice(0, 200)); } catch { setHint("İhtiyacı keşfet, sonra faydayı somut anlat."); }
    setHintBusy(false);
  }
  function startListen(autoSend = false) {
    if (!SR || thinkingRef.current || endedRef.current) return;
    try {
      const rec = new SR(); rec.lang = "tr-TR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1; let finalText = "";
      rec.onresult = (e) => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += tr; else it += tr; } setInput((finalText + it).trim()); };
      rec.onerror = () => setListening(false);
      rec.onend = () => { setListening(false); const t = finalText.trim(); if (t) { if (voiceRef.current || autoSend) { setInput(""); doSend(t); } else setInput(t); } };
      recogRef.current = rec; setListening(true); rec.start();
    } catch { setListening(false); }
  }
  function stopListen() { try { recogRef.current && recogRef.current.stop(); } catch {} setListening(false); }
  function toggleVoice() {
    const nv = !voiceMode; setVoiceMode(nv); voiceRef.current = nv;
    if (!nv) { stopListen(); }
    else { if (!thinkingRef.current && !endedRef.current) startListen(true); }
  }
  async function finish() {
    const reps = turns.filter((t) => t.who === "r").length; if (scoring || reps < 1) return;
    try { synth && synth.cancel(); } catch {} stopListen(); setScoring(true); setErr("");
    const tr = turns.map((t) => (t.who === "r" ? "Temsilci: " : "Müşteri: ") + t.text).join("\n");
    const sys = `Gürgençler (Apple Premium Reseller) için SERT ama yapıcı bir satış koçusun. KPI: ${scenario.kpi}. Transkripti İhtiyaç Keşfi, Teklif Zamanlaması, Değer İletişimi, İtiraz Yönetimi, Kapanış başlıklarında 0-100 puanla.
PUANLAMA ÇOK SIKI: Ortalama temsilci 45-65 alır. 80+ yalnızca güçlü, eksiksiz keşif + net kapanış varsa verilir; 90+ neredeyse kusursuz performansa. Zayıf keşif, erken teklif, baskıcı/robotik dil, kapanışı denememek puanı sert düşürür. Satış kapanmadıysa (müşteri almadıysa) genel skor 60'ı GEÇMESİN. Asla cömert olma; hak edilmeyen yüksek puan verme.
SADECE JSON: {"score":0-100,"stars":0-5,"headline":"...","kpis":[{"name":"İhtiyaç Keşfi","score":0},{"name":"Teklif Zamanlaması","score":0},{"name":"Değer İletişimi","score":0},{"name":"İtiraz Yönetimi","score":0},{"name":"Kapanış","score":0}],"strengths":["..."],"improvements":["..."],"suggestions":["..."]}`;
    try {
      const fb = looseJSON(await callClaude(sys, [{ role: "user", content: "TRANSKRİPT:\n\n" + tr }]));
      const outcome = ended || "lost";
      const rec = (await sget(skey(user.username))) || { username: user.username, bestScore: 0, sessions: 0, totalXp: 0, perKpi: {}, recent: [], outcomes: { won: 0, lost: 0 } };
      const today = todayStr();
      applyStreak(rec, today);
      const mult = streakMult(rec.streak || 1);
      let bonus = 0; if (scenario.daily && rec.dailyDone !== today) { bonus = 30; rec.dailyDone = today; }
      const gainXp = Math.round(Math.round(fb.score * 0.5) * mult) + bonus;
      rec.bestScore = Math.max(rec.bestScore || 0, fb.score); rec.sessions = (rec.sessions || 0) + 1; rec.totalXp = (rec.totalXp || 0) + gainXp;
      rec.coins = (rec.coins || 0) + Math.round(fb.score * 0.3) + (scenario.daily ? 10 : 0);
      rec.perKpi = rec.perKpi || {}; const pk = rec.perKpi[scenario.kpi] || { best: 0, sessions: 0 }; rec.perKpi[scenario.kpi] = { best: Math.max(pk.best, fb.score), sessions: pk.sessions + 1 };
      rec.outcomes = rec.outcomes || { won: 0, lost: 0 }; rec.outcomes[outcome] = (rec.outcomes[outcome] || 0) + 1;
      rec.recent = [...(rec.recent || []), { score: fb.score, kpi: scenario.kpi, ts: Date.now() }].slice(-12);
      if (rec.homework && rec.homework.scenarioId === scenario.id) rec.homework = null;
      await sset(skey(user.username), rec);
      onResult({ ...fb, outcome, gainXp, mult });
    } catch { setErr("Skorlama yapılamadı, tekrar dene."); }
    setScoring(false);
  }
  const reps = turns.filter((t) => t.who === "r").length;
  if (!ready) return <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /><p className="mt-3 text-sm text-slate-500">Müşteri hazırlanıyor…</p></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><button onClick={() => { try { synth && synth.cancel(); } catch {} stopListen(); onQuit(); }} className="text-sm font-semibold text-slate-500">← Vazgeç</button><button onClick={toggleVoice} disabled={!SR} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${voiceMode ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"} disabled:opacity-40`}>{voiceMode ? <Mic className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />} Eller serbest</button></div>
      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white"><Target className="h-3 w-3" /> {scenario.kpi}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF[scenario.diff || "orta"].cls}`}>{DIFF[scenario.diff || "orta"].label}</span></div><p className="mt-2 text-[13px] leading-snug text-slate-600">{scenario.brief}</p></div>
      <div className={`relative flex flex-col items-center overflow-hidden rounded-3xl px-4 pb-4 pt-4 ring-1 ring-slate-200 ${MOODS[mood]?.bg}`}>
        <div className="absolute right-3 top-3 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold text-slate-500">tur {reps}</div>
        <div className="sk-bob h-44 w-44"><CharacterFace mood={mood} talking={talking} thinking={thinking} female={genderOf(scenario.name, scenario.gender) === "k"} /></div>
        <div className="-mt-1 text-sm font-bold text-slate-700">{scenario.name}</div>
        <div className={`text-xl font-extrabold ${MOODS[mood]?.text}`}>{MOODS[mood]?.label}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">{talking ? <><span className="flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" /> konuşuyor…</> : thinking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> düşünüyor…</> : listening ? <><span className="flex h-2 w-2 animate-pulse rounded-full bg-rose-500" /> seni dinliyor…</> : "sıra sende"}</div>
      </div>
      <div ref={ref} className="h-[24vh] min-h-[150px] space-y-3 overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        {turns.map((t, i) => t.who === "c" ? (
          <div key={i} className="flex items-end gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">{MOODS[t.emotion]?.emoji || "🙂"}</div><div className="max-w-[80%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800">{t.text}<button onClick={() => sayOut(t.text, undefined, t.emotion)} title="Dinle" className="ml-1.5 inline-flex translate-y-0.5 text-slate-400 hover:text-indigo-600"><Volume2 className="h-3.5 w-3.5" /></button></div></div>
        ) : (
          <div key={i} className="flex justify-end"><div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 px-3.5 py-2.5 text-[14px] leading-relaxed text-white">{t.text}</div></div>
        ))}
        {thinking && <div className="flex items-center gap-2 pl-9 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {scenario.name} düşünüyor…</div>}
        {listening && <div className="flex items-center gap-2 pl-9 text-xs font-medium text-rose-500"><span className="flex h-2 w-2 animate-pulse rounded-full bg-rose-500" /> Dinliyorum…</div>}
        {ended === "won" && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200"><ShieldCheck className="h-4 w-4" /> Satış kazanıldı! Bitirip skoru al.</div>}
        {ended === "lost" && <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200"><X className="h-4 w-4" /> Müşteri vazgeçti. Bitirip ne öğrendiğini gör.</div>}
      </div>
      {hint && <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800 ring-1 ring-amber-200"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {hint}</div>}
      {err && <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> {err}</div>}
      {!keyboard ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <button onClick={() => { if (listening) stopListen(); else startListen(true); }} disabled={!SR || thinking || !!ended} title={SR ? "Konuşmak için bas" : "Tarayıcı sesi desteklemiyor"} className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition disabled:opacity-30 ${listening ? "scale-105 animate-pulse bg-rose-500 text-white" : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:scale-105"}`}><Mic className="h-8 w-8" /></button>
          <div className="text-[12px] font-medium text-slate-400">{!SR ? "Tarayıcı sesi desteklemiyor" : thinking ? "müşteri düşünüyor…" : !!ended ? "konuşma bitti" : listening ? "dinliyorum… bitince tekrar bas" : "konuşmak için bas"}</div>
          <button onClick={() => setKeyboard(true)} className="text-[11px] font-semibold text-slate-400 underline underline-offset-2">{SR ? "klavyeyle yaz" : "yazarak devam et"}</button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200"><div className="flex items-end gap-2"><button onClick={() => { if (listening) stopListen(); else startListen(false); }} disabled={!SR || thinking || !!ended} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-30 ${listening ? "animate-pulse bg-rose-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Mic className="h-4 w-4" /></button><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(input); } }} rows={1} disabled={thinking || !!ended} placeholder={ended ? "Konuşma bitti" : listening ? "Dinliyorum…" : "Yaz ya da mikrofona bas…"} className="max-h-24 flex-1 resize-none bg-transparent px-1 py-2 text-[14px] outline-none placeholder:text-slate-400 disabled:opacity-50" /><button onClick={() => doSend(input)} disabled={thinking || !!ended || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white disabled:opacity-30"><Send className="h-4 w-4" /></button></div></div>
          <button onClick={() => setKeyboard(false)} className="w-full text-center text-[11px] font-semibold text-slate-400">↑ karakter moduna dön</button>
        </div>
      )}
      <div className="flex gap-2"><button onClick={getHint} disabled={hintBusy || !!ended} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-amber-600 ring-1 ring-amber-200 disabled:opacity-40">{hintBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />} İpucu</button><button onClick={finish} disabled={scoring || reps < 1} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40">{scoring ? <><Loader2 className="h-4 w-4 animate-spin" /> Skorlanıyor…</> : <><Flag className="h-4 w-4" /> Bitir & skoru al</>}</button></div>
    </div>
  );
}

function Result({ fb, scenario, onAgain, onHome }) {
  const f = { score: fb.score ?? 0, stars: fb.stars ?? 0, headline: fb.headline || "Tamamlandı", kpis: fb.kpis || [], strengths: fb.strengths || [], improvements: fb.improvements || [], suggestions: fb.suggestions || [] };
  const r = 34, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, f.score)), color = pct >= 80 ? "#059669" : pct >= 60 ? "#d97706" : "#e11d48";
  const full = Math.floor(f.stars), half = f.stars - full >= 0.5;
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 pop-in">
        <div className="flex items-center gap-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50 px-5 py-5"><div className="relative h-[88px] w-[88px] shrink-0"><svg className="h-full w-full -rotate-90" viewBox="0 0 80 80"><circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" /><circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .9s ease" }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold tracking-tight">{pct}</span><span className="text-[10px] text-slate-400">/100</span></div></div><div><div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => { const fl = i < full ? 1 : i === full && half ? 0.5 : 0; return <span key={i} className="relative text-base"><span className="text-slate-200">★</span><span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fl * 100}%` }}>★</span></span>; })}</div><div className="mt-1.5 text-lg font-bold leading-tight tracking-tight">{f.headline}</div><div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold"><span className="flex items-center gap-1 text-amber-600"><Zap className="h-3 w-3" /> +{fb.gainXp != null ? fb.gainXp : Math.round(pct * 0.5)} XP</span>{fb.mult > 1 && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-700">🔥 ×{fb.mult}</span>}{fb.outcome === "won" ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Kazanıldı</span> : <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-600">Kaybedildi</span>}</div></div></div>
        <div className="space-y-2.5 px-5 py-4">{f.kpis.map((k, i) => <div key={i}><div className="mb-1 flex justify-between text-[13px]"><span className="font-medium text-slate-600">{k.name}</span><span className="font-bold">{k.score}</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, k.score))}%` }} /></div></div>)}</div>
      </div>
      <Block tone="emerald" icon={<TrendingUp className="h-4 w-4" />} title="Güçlü Yönlerin" items={f.strengths} />
      <Block tone="rose" icon={<Target className="h-4 w-4" />} title="Geliştirme Alanın" items={f.improvements} />
      <Block tone="indigo" icon={<MessageCircle className="h-4 w-4" />} title="Önerimiz" items={f.suggestions} />
      <div className="flex gap-2"><button onClick={onAgain} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white"><RotateCcw className="h-4 w-4" /> Yeni prova</button><button onClick={onHome} className="rounded-xl bg-white px-5 py-3.5 text-[15px] font-semibold text-slate-600 ring-1 ring-slate-200">Ana sayfa</button></div>
    </div>
  );
}
function Block({ tone, icon, title, items }) {
  const t = { emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" }, rose: { bg: "bg-rose-50", ring: "ring-rose-100", text: "text-rose-700", dot: "bg-rose-500" }, indigo: { bg: "bg-indigo-50", ring: "ring-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500" } }[tone];
  if (!items || !items.length) return null;
  return <div className={`rounded-2xl ${t.bg} px-5 py-4 ring-1 ${t.ring}`}><div className={`mb-2.5 flex items-center gap-1.5 text-sm font-bold ${t.text}`}>{icon} {title}</div><ul className="space-y-2">{items.map((it, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-slate-700"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} /><span>{it}</span></li>)}</ul></div>;
}

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function Quiz({ user, onDone, onBack }) {
  const [qs, setQs] = useState(null); const [i, setI] = useState(0), [picked, setPicked] = useState(null), [score, setScore] = useState(0), [done, setDone] = useState(false);
  useEffect(() => { (async () => {
    let weak = "genel satış"; try { const rec = await sget(skey(user.username)); const pk = Object.entries(rec?.perKpi || {}); if (pk.length) weak = pk.sort((a, b) => (a[1].best || 0) - (b[1].best || 0))[0][0]; } catch {}
    const sys = `Apple Premium Reseller (Türkiye) satış bilgisi için 5 adet ZORLAYICI, birbirinden farklı çoktan seçmeli soru üret. Ağırlık ver: ${weak}. Her soru 3 şıklı, tek doğru cevap. Şıklar kısa olsun. SADECE JSON: {"questions":[{"q":"...","a":["..","..",".."],"c":0}]}`;
    try { const r = looseJSON(await callClaude(sys, [{ role: "user", content: "Yeni, daha önce sorulmamış sorular üret." }])); const arr = (r.questions || []).filter((x) => x.a && x.a.length === 3 && typeof x.c === "number"); setQs(arr.length >= 3 ? arr.slice(0, 5) : shuffle(QUIZ).slice(0, 5)); }
    catch { setQs(shuffle(QUIZ).slice(0, 5)); }
  })(); }, []);
  if (!qs) return <div className="space-y-4"><button onClick={onBack} className="text-sm font-semibold text-slate-500">← Geri</button><div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /><p className="mt-3 text-sm text-slate-500">Sana özel sorular hazırlanıyor…</p></div></div>;
  const q = qs[i];
  function choose(idx) {
    if (picked !== null) return; setPicked(idx); const correct = idx === q.c; if (correct) setScore((s) => s + 1);
    setTimeout(async () => { if (i + 1 < qs.length) { setI(i + 1); setPicked(null); } else { setDone(true); const rec = await sget(skey(user.username)); if (rec) { const got = score + (correct ? 1 : 0); rec.totalXp = (rec.totalXp || 0) + got * 8; rec.coins = (rec.coins || 0) + got * 4; await sset(skey(user.username), rec); } } }, 700);
  }
  if (done) return <div className="space-y-4"><div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 pop-in"><div className="text-4xl font-bold tracking-tight">{score}/{qs.length}</div><div className="mt-1 text-sm text-slate-500">doğru · +{score * 8} XP</div></div><button onClick={onDone} className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white">Bitir</button></div>;
  return (
    <div className="space-y-4"><button onClick={onBack} className="text-sm font-semibold text-slate-500">← Geri</button><div className="flex items-center justify-between text-xs font-semibold text-slate-400"><span>Soru {i + 1}/{qs.length}</span><span>{score} doğru</span></div><div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><div className="text-base font-bold leading-snug">{q.q}</div><div className="mt-4 space-y-2">{q.a.map((opt, idx) => { let cls = "bg-slate-50 ring-slate-200"; if (picked !== null) { if (idx === q.c) cls = "bg-emerald-50 ring-emerald-300"; else if (idx === picked) cls = "bg-rose-50 ring-rose-300"; } return <button key={idx} onClick={() => choose(idx)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 ${cls}`}>{opt}{picked !== null && idx === q.c && <Check className="h-4 w-4 text-emerald-600" />}</button>; })}</div></div></div>
  );
}

/* ====================== yönetici ====================== */
function matchScenario(catalog, kpi) {
  const k = (kpi || "").toLowerCase();
  return catalog.find((s) => s.kpi.toLowerCase() === k) || catalog.find((s) => s.kpi.toLowerCase().includes(k.split(" ")[0])) || catalog.find((s) => k.includes(s.kpi.toLowerCase().split(" ")[0]));
}

function ManagerTab({ board, catalog, reload }) {
  const team = board;
  const totalProvas = team.reduce((s, r) => s + (r.sessions || 0), 0);
  const kpiAgg = useMemo(() => { const m = {}; team.forEach((r) => Object.entries(r.perKpi || {}).forEach(([k, v]) => { m[k] = m[k] || { sum: 0, n: 0 }; m[k].sum += v.best; m[k].n++; })); return Object.entries(m).map(([k, v]) => ({ k, avg: Math.round(v.sum / v.n) })).sort((a, b) => a.avg - b.avg); }, [board]);
  const weakest = kpiAgg[0];
  const withReal = team.filter((r) => r.realKpi && typeof r.realKpi.actual === "number");
  const med = withReal.length ? [...withReal].sort((a, b) => (a.sessions || 0) - (b.sessions || 0))[Math.floor(withReal.length / 2)].sessions : 0;
  const high = withReal.filter((r) => (r.sessions || 0) >= med), low = withReal.filter((r) => (r.sessions || 0) < med);
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, r) => s + r.realKpi.actual, 0) / arr.length) : 0;

  const [msg, setMsg] = useState(""); const [imp, setImp] = useState(null);
  const [hwUser, setHwUser] = useState(""), [hwScn, setHwScn] = useState(catalog[0]?.id || "");
  const [sel, setSel] = useState(""); const [showAdd, setShowAdd] = useState(false);
  const [ns, setNs] = useState({ name: "", product: "", kpi: "Sigorta Attach", diff: "orta", emoji: "📱", brief: "", persona: "", mood: "supheci" });
  const selRec = team.find((r) => r.username === sel);

  function downloadTemplate() {
    const rows = [["Satici", "KPI", "Gercek", "Hedef"], ["ugur", "Sigorta Attach", 18, 25], ["ugur", "Aksesuar Attach", 32, 40], ["Ahmet", "Mac Upgrade", 22, 30]];
    const ws = XLSX.utils.aoa_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Satislar"); XLSX.writeFile(wb, "satis-sablon.xlsx");
  }
  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return; setMsg("İçe aktarılıyor…");
    try {
      const data = new Uint8Array(await f.arrayBuffer()); const wb = XLSX.read(data, { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const byUser = {};
      rows.forEach((row) => { const o = {}; Object.keys(row).forEach((k) => (o[k.toLowerCase().trim()] = row[k])); const u = (o["satici"] || o["satıcı"] || o["kullanici"] || o["kullanıcı"] || o["isim"] || "").toString().trim(); const kpi = (o["kpi"] || "").toString().trim(); const ger = +(o["gercek"] || o["gerçek"] || o["gercek%"] || 0); const hed = +(o["hedef"] || 25); if (!u || !kpi) return; byUser[u.toLowerCase()] = byUser[u.toLowerCase()] || { name: u, rows: [] }; byUser[u.toLowerCase()].rows.push({ kpi, ger, hed }); });
      let updated = 0, unknown = [];
      for (const key of Object.keys(byUser)) {
        const rec = await sget(skey(key)); if (!rec) { unknown.push(byUser[key].name); continue; }
        rec.realByKpi = rec.realByKpi || {}; byUser[key].rows.forEach((r) => (rec.realByKpi[r.kpi] = { actual: r.ger, target: r.hed }));
        const vals = Object.values(rec.realByKpi); rec.realKpi = { actual: Math.round(vals.reduce((s, v) => s + v.actual, 0) / vals.length), target: Math.round(vals.reduce((s, v) => s + v.target, 0) / vals.length) };
        await sset(skey(key), rec); updated++;
      }
      setImp({ updated, unknown }); setMsg(`İçe aktarıldı: ${updated} satıcı güncellendi.` + (unknown.length ? ` Bulunamadı: ${unknown.join(", ")}` : "")); reload();
    } catch { setMsg("Dosya okunamadı. Şablona uygun .xlsx/.csv kullan."); }
    e.target.value = "";
  }
  async function autoAssign() {
    let n = 0;
    for (const r of team) {
      const rb = r.realByKpi || {}; const entries = Object.entries(rb); if (!entries.length) continue;
      entries.sort((a, b) => (a[1].actual / (a[1].target || 1)) - (b[1].actual / (b[1].target || 1)));
      const weakKpi = entries[0][0]; const sc = matchScenario(catalog, weakKpi); if (!sc) continue;
      const rec = await sget(skey(r.username)); if (rec) { rec.homework = { scenarioId: sc.id, ts: Date.now() }; await sset(skey(r.username), rec); n++; }
    }
    setMsg(`Verimliliğe göre ${n} satıcıya en zayıf KPI'da ödev atandı.`); reload();
  }
  async function assignHw() { if (!hwUser) return; const rec = await sget(skey(hwUser)); if (rec) { rec.homework = { scenarioId: hwScn, ts: Date.now() }; await sset(skey(hwUser), rec); setMsg("Ödev atandı: " + hwUser); reload(); } }
  async function addScenario() { if (!ns.name || !ns.persona) { setMsg("İsim ve persona gerekli."); return; } const list = (await sget("cscn:list")) || []; list.push({ ...ns, id: "c-" + Date.now(), custom: true }); await sset("cscn:list", list); setShowAdd(false); setMsg("Senaryo eklendi."); reload(); }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight">Yönetici Paneli</h1>
      {msg && <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">{msg}</div>}
      <div className="grid grid-cols-3 gap-3"><Stat label="Satıcı" value={team.length} accent /><Stat label="Toplam prova" value={totalProvas} /><Stat label="En zayıf KPI" value={weakest ? weakest.avg : "—"} /></div>

      {/* Excel içe aktarma */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold"><Upload className="h-4 w-4 text-indigo-600" /> Toplu satış verisi (Excel)</div>
        <p className="mb-3 text-[11px] text-slate-400">Sütunlar: <b>Satici, KPI, Gercek, Hedef</b>. Şablonu indir, doldur, yükle.</p>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700"><Download className="h-4 w-4" /> Şablon</button>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white"><Upload className="h-4 w-4" /> Yükle<input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" /></label>
        </div>
        {imp && <button onClick={autoAssign} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 px-3 py-2.5 text-sm font-semibold text-white"><Wand2 className="h-4 w-4" /> Verimliliğe göre otomatik ödev ata</button>}
      </div>

      {/* KPI ortalamaları */}
      {weakest && <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><BarChart3 className="h-4 w-4 text-indigo-600" /> KPI Ortalamaları (ekip)</div><div className="space-y-2.5">{kpiAgg.map((x) => <div key={x.k}><div className="mb-1 flex justify-between text-[13px]"><span className="font-medium text-slate-600">{x.k}</span><span className="font-bold">{x.avg}</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${x.avg < 70 ? "bg-rose-500" : x.avg < 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${x.avg}%` }} /></div></div>)}</div><p className="mt-3 text-[11px] text-slate-400">En zayıf alan: <b>{weakest.k}</b></p></div>}

      {/* A/B */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-1 flex items-center gap-2 text-sm font-bold"><TrendingUp className="h-4 w-4 text-emerald-600" /> Prova ↔ Gerçek Attach (A/B)</div><p className="mb-3 text-[11px] text-slate-400">Gerçek attach üzerinden: çok prova yapan vs az yapan. (Canlı ClickHouse backend fazında.)</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 px-3 py-3 text-center ring-1 ring-emerald-100"><div className="text-2xl font-bold text-emerald-700">%{avg(high)}</div><div className="text-[11px] text-slate-500">Çok prova ({high.length})</div></div><div className="rounded-xl bg-slate-50 px-3 py-3 text-center ring-1 ring-slate-200"><div className="text-2xl font-bold text-slate-600">%{avg(low)}</div><div className="text-[11px] text-slate-500">Az prova ({low.length})</div></div></div>{withReal.length > 1 && <div className="mt-2 text-center text-[13px] font-semibold text-emerald-700">Fark: +{Math.max(0, avg(high) - avg(low))} puan</div>}</div>

      {/* Kişi bazında dashboard */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Activity className="h-4 w-4 text-indigo-600" /> Kişi Dashboard</div>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"><option value="">Satıcı seç</option>{team.map((r) => <option key={r.username}>{r.username}</option>)}</select>
        {selRec && <RepDashboard r={selRec} />}
      </div>

      {/* ödev ata */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="mb-3 text-sm font-bold">Ödev senaryo ata</div><div className="space-y-2"><select value={hwUser} onChange={(e) => setHwUser(e.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"><option value="">Satıcı seç</option>{team.map((r) => <option key={r.username}>{r.username}</option>)}</select><select value={hwScn} onChange={(e) => setHwScn(e.target.value)} className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">{catalog.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.kpi} — {s.name}</option>)}</select><button onClick={assignHw} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white">Ödevi ata</button></div></div>

      {/* özel senaryo */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><button onClick={() => setShowAdd(!showAdd)} className="flex w-full items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><Plus className="h-4 w-4 text-indigo-600" /> Kendi senaryonu ekle</span>{showAdd ? <X className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}</button>{showAdd && <div className="mt-3 space-y-2"><div className="flex gap-2"><input value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} placeholder="Müşteri adı" className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" /><input value={ns.emoji} onChange={(e) => setNs({ ...ns, emoji: e.target.value })} placeholder="emoji" className="w-16 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm ring-1 ring-slate-200" /></div><input value={ns.product} onChange={(e) => setNs({ ...ns, product: e.target.value })} placeholder="Ürün" className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" /><div className="flex gap-2"><input value={ns.kpi} onChange={(e) => setNs({ ...ns, kpi: e.target.value })} placeholder="KPI" className="flex-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" /><select value={ns.diff} onChange={(e) => setNs({ ...ns, diff: e.target.value })} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200"><option value="kolay">Kolay</option><option value="orta">Orta</option><option value="zor">Zor</option></select></div><input value={ns.brief} onChange={(e) => setNs({ ...ns, brief: e.target.value })} placeholder="Kısa özet" className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" /><textarea value={ns.persona} onChange={(e) => setNs({ ...ns, persona: e.target.value })} placeholder="Müşteri davranışı / itirazlar" rows={3} className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200" /><button onClick={addScenario} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white">Senaryoyu ekle</button></div>}</div>
    </div>
  );
}

function RepDashboard({ r }) {
  const lv = levelInfo(r.totalXp || 0);
  const recent = (r.recent || []).slice(-10);
  const perKpi = Object.entries(r.perKpi || {});
  const realByKpi = Object.entries(r.realByKpi || {});
  return (
    <div className="mt-3 space-y-4 pop-in">
      <div className="flex items-center gap-3"><Avatar name={r.username} color={r.avatarColor} size="h-12 w-12" /><div><div className="text-base font-bold">{r.username}</div><div className="text-xs text-slate-400">Lv {lv.level} · {r.store || "—"} · {r.sessions || 0} prova · dönüşüm {convPct(r)}</div></div></div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-base font-bold">{r.bestScore || 0}</div><div className="text-[9px] text-slate-400">En iyi</div></div>
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-base font-bold text-orange-500">{r.streak || 0}</div><div className="text-[9px] text-slate-400">Seri</div></div>
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-base font-bold text-emerald-600">{r.outcomes?.won || 0}</div><div className="text-[9px] text-slate-400">Kazanç</div></div>
        <div className="rounded-xl bg-slate-50 py-2"><div className="text-base font-bold text-rose-500">{r.outcomes?.lost || 0}</div><div className="text-[9px] text-slate-400">Kayıp</div></div>
      </div>

      {recent.length > 0 && <div><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Puan grafiği</div><div className="flex items-end gap-1.5">{recent.map((s, i) => { const col = s.score >= 80 ? "from-emerald-500 to-emerald-400" : s.score >= 60 ? "from-amber-500 to-amber-400" : "from-rose-500 to-rose-400"; return <div key={i} className="flex flex-1 flex-col items-center gap-1"><div className="flex w-full items-end justify-center" style={{ height: 60 }}><div className={`w-full max-w-[22px] rounded-t-md bg-gradient-to-t ${col}`} style={{ height: `${Math.max(6, (s.score / 100) * 60)}px` }} /></div><span className="text-[10px] font-semibold text-slate-500">{s.score}</span></div>; })}</div></div>}

      {perKpi.length > 0 && <div><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">KPI durumu (prova)</div><div className="space-y-2">{perKpi.map(([k, v]) => <div key={k}><div className="mb-0.5 flex justify-between text-[12px]"><span className="text-slate-600">{k}</span><span className="font-bold">{v.best}</span></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${v.best < 70 ? "bg-rose-500" : v.best < 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(3, v.best)}%` }} /></div></div>)}</div></div>}

      {realByKpi.length > 0 && <div><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Gerçek attach vs hedef</div><div className="space-y-2">{realByKpi.map(([k, v]) => { const ok = v.actual >= v.target; return <div key={k}><div className="mb-0.5 flex justify-between text-[12px]"><span className="text-slate-600">{k}</span><span className={`font-bold ${ok ? "text-emerald-600" : "text-rose-500"}`}>%{v.actual} / %{v.target}</span></div><div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, (v.actual / (v.target || 1)) * 100)}%` }} /></div></div>; })}</div></div>}
    </div>
  );
}

function CoachTab({ user, onUpdate }) {
  const [obj, setObj] = useState(""); const [busy, setBusy] = useState(false); const [res, setRes] = useState(null); const [err, setErr] = useState("");
  async function ask(text) {
    const t = (text || obj).trim(); if (!t || busy) return;
    setObj(t); setBusy(true); setErr(""); setRes(null);
    const sys = `Sen Gürgençler (Apple Premium Reseller, Türkiye) için kıdemli bir satış koçusun. Personel sana bir müşteri itirazı yazacak; kısa, uygulanabilir, Türkçe yanıt ver.
${PRODUCTS}
SADECE JSON: {"taktikler":["3-4 kısa uygulanabilir ikna taktiği"],"capraz":["bu duruma uygun 1-3 çapraz/üst satış kombinasyonu, güncel ürünlerden"],"ornek":"temsilcinin kullanabileceği tek doğal örnek cümle"}`;
    try { const r = looseJSON(await callClaude(sys, [{ role: "user", content: "Müşteri itirazı: " + t }])); setRes(r); try { const rec = await sget(skey(user.username)); if (rec) { rec.totalXp = (rec.totalXp || 0) + 5; rec.coins = (rec.coins || 0) + 3; await sset(skey(user.username), rec); onUpdate && onUpdate(); } } catch {} }
    catch { setErr("Öneri alınamadı, tekrar dene."); }
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold tracking-tight">Hızlı İtiraz Koçu</h1><p className="text-sm text-slate-500">Müşteri itirazını yaz, anında ikna taktiği + çapraz satış önerisi al. (Prova değil, anlık yardım.)</p></div>
      <div className="flex flex-wrap gap-2">{OBJECTIONS.map((o) => <button key={o} onClick={() => ask(o)} disabled={busy} className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 ring-1 ring-slate-200 disabled:opacity-50">{o}</button>)}</div>
      <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200"><textarea value={obj} onChange={(e) => setObj(e.target.value)} rows={2} placeholder="Örn: 'Pro Max çok pahalı, normalini alayım' diyor…" className="w-full resize-none bg-transparent px-2 py-2 text-[14px] outline-none placeholder:text-slate-400" /><button onClick={() => ask()} disabled={busy || !obj.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Tavsiye al</button></div>
      {err && <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> {err}</div>}
      {res && <div className="space-y-3 pop-in">
        <Block tone="indigo" icon={<Lightbulb className="h-4 w-4" />} title="İkna Taktikleri" items={res.taktikler || []} />
        <Block tone="emerald" icon={<TrendingUp className="h-4 w-4" />} title="Çapraz / Üst Satış" items={res.capraz || []} />
        {res.ornek && <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white"><div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-300"><MessageCircle className="h-3.5 w-3.5" /> Örnek cümle</div><p className="text-[14px] leading-relaxed">{res.ornek}</p></div>}
      </div>}
    </div>
  );
}

function BottomNav({ tab, setTab, manager }) {
  const items = [{ id: "home", icon: HomeIcon, label: "Ana" }, { id: "play", icon: Swords, label: "Prova" }, { id: "coach", icon: Lightbulb, label: "Koç" }, { id: "board", icon: Trophy, label: "Lider" }];
  if (manager) items.push({ id: "mgr", icon: Users, label: "Yönetici" });
  items.push({ id: "profile", icon: User, label: "Profil" });
  return <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-md items-center justify-around px-1 py-2">{items.map((it) => { const Icon = it.icon, active = tab === it.id; return <button key={it.id} onClick={() => setTab(it.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-1 ${active ? "text-indigo-600" : "text-slate-400"}`}><span className={`flex h-7 w-11 items-center justify-center rounded-full transition ${active ? "bg-indigo-50" : ""}`}><Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} /></span><span className="text-[10px] font-semibold">{it.label}</span></button>; })}</div></div>;
}
