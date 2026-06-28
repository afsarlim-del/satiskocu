import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  Send, RotateCcw, Sparkles, Target, ShieldCheck, AlertCircle, Loader2,
  TrendingUp, MessageCircle, Flag, ArrowRight, LogOut, Trophy, Home as HomeIcon,
  Swords, User, ChevronRight, Zap, Crown, Dices, Mic, Volume2, VolumeX,
  Flame, Lightbulb, Users, BarChart3, BookOpen, Plus, ShieldAlert, CalendarDays, X, Check,
  Upload, Download, Activity, Wand2,
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
function speak(text, onDone) {
  if (!synth || !text) { onDone && onDone(); return; }
  try {
    synth.cancel();
    if (!VOICES.length) loadVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "tr-TR";
    const v = VOICES.find((x) => (x.lang || "").toLowerCase().startsWith("tr")) || VOICES.find((x) => (x.lang || "").toLowerCase().startsWith("en"));
    if (v) u.voice = v;
    u.rate = 1.03;
    u.onend = () => onDone && onDone();
    u.onerror = () => onDone && onDone();
    synth.resume();
    synth.speak(u);
  } catch { onDone && onDone(); }
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
const DIFF = { kolay: { label: "Kolay", cls: "bg-emerald-100 text-emerald-700" }, orta: { label: "Orta", cls: "bg-amber-100 text-amber-700" }, zor: { label: "Zor", cls: "bg-rose-100 text-rose-700" } };

const BASE_CATALOG = [
  { id: "iph-ac", emoji: "📱", product: "iPhone 17", kpi: "AppleCare+ Attach", diff: "orta", name: "Kaan", mood: "supheci", brief: "İlk kez AppleCare+ düşünüyor, 'ben düşürmem' diyor.", persona: "Sen Kaan, 34. Sahada çalışıyorsun, telefon hep elinde. AppleCare+'a mesafelisin. İtirazların: 'pahalı', 'gerek yok'. Onarım maliyeti + gönül rahatlığı somut anlatılırsa yumuşa; baskıda diren. Eşinin de kullanacağı çıkarsa ikna ol." },
  { id: "mac-up", emoji: "💻", product: "MacBook Air → Pro", kpi: "Mac Upgrade", diff: "zor", name: "Selin", mood: "dusunuyor", brief: "MacBook Air'a karar verdi ama işi Pro gerektirebilir.", persona: "Sen Selin, 29, video editörü. Air'a karar verdin, bütçen kısıtlı. İtirazların: 'Air yeter', 'Pro pahalı'. İş yükün (4K kurgu) öğrenilip Pro'nun zaman kazandırdığı rakamla anlatılırsa ikna olmaya başla; sadece 'daha güçlü' derse diren. Kolay ikna olma." },
  { id: "airpods", emoji: "🎧", product: "AirPods + aksesuar", kpi: "Aksesuar Attach", diff: "kolay", name: "Elif", mood: "ilgili", brief: "iPhone aldı, aksesuar düşünmüyor ama açık.", persona: "Sen Elif, 26. Yeni iPhone aldın, keyiflisin. Aksesuar düşünmedin ama açıksın. İtirazın hafif: 'sonra bakarım'. Spor/müzik alışkanlığın öğrenilip AirPods ona göre konumlandırılırsa hızlı ikna ol." },
  { id: "tradein", emoji: "🔄", product: "iPhone 13 takas", kpi: "Trade-In", diff: "orta", name: "Murat", mood: "dusunuyor", brief: "Eski telefonunu takas etmeyi düşünüyor ama tereddütlü.", persona: "Sen Murat, 41. iPhone 13'ünü vermeyi düşünüyorsun ama 'ikinci elde daha çok eder' diyorsun. İtirazın: 'takasta az veriyorlar'. Güvenlik, kolaylık, anlık indirim anlatılırsa ikna ol; geçiştirilirse vazgeç." },
  { id: "finance", emoji: "💳", product: "iPhone 17 Pro + taksit", kpi: "Finansman", diff: "orta", name: "Hakan", mood: "tereddut", brief: "Pro istiyor ama peşin fiyat gözünü korkutuyor.", persona: "Sen Hakan, 37. Pro istiyorsun ama peşin fiyat yüksek, vazgeçmek üzeresin. İtirazın: 'şu an bütçem yok'. Taksit aylık küçük tutara bölünüp fayda netleşirse ikna ol." },
  { id: "watch", emoji: "⌚", product: "Apple Watch", kpi: "Watch Attach", diff: "kolay", name: "Aslı", mood: "ilgili", brief: "Spora başladı, Watch'a sıcak bakıyor.", persona: "Sen Aslı, 31. Koşuya başladın, Watch merak ediyorsun ama 'telefonum var, gerek var mı' diyorsun. Nabız, koşu metrikleri, hedef takibi anlatılırsa hızlı ikna ol." },
  { id: "ipad", emoji: "✏️", product: "iPad + Pencil + Klavye", kpi: "iPad Attach", diff: "orta", name: "Deniz", mood: "dusunuyor", brief: "Öğrenci, sadece iPad düşünüyor; aksesuarsız.", persona: "Sen Deniz, 20, mimarlık öğrencisi. iPad istiyorsun, 'çıplak iPad yeter' diyorsun. İtirazın: 'öğrenci bütçesi'. Not + çizim ihtiyacın öğrenilip Pencil ve klavye gerekçelenirse ikna ol." },
  { id: "premium", emoji: "🏆", product: "iPhone + Mac + Koruma", kpi: "Premium Satış", diff: "zor", name: "Mehmet Bey", mood: "supheci", brief: "Pazarlıkçı işletme sahibi, çoklu cihaz alabilir.", persona: "Sen Mehmet Bey, 48, işletme sahibi. Kendine iPhone, ekibe Mac düşünüyorsun ama pazarlıkçı ve şüphecisin. İtirazların: 'indirim yok mu', 'koruma şart mı'. İşine somut katkı anlatılırsa açıl; özellik sayan temsilciye soğu. Zorlu pazarlık yap." },
  { id: "rakip", emoji: "🏷️", product: "iPhone 17 (fiyat itirazı)", kpi: "AppleCare+ Attach", diff: "zor", name: "Tolga", mood: "supheci", brief: "'Teknosa'da daha ucuz' diyerek geliyor.", persona: "Sen Tolga, 35. Telefonu başka yerde daha ucuz gördün ve bunu sürekli dile getiriyorsun: 'Teknosa'da indirimliydi'. İtirazların fiyat odaklı. Temsilci sadece fiyatı savunursa soğu; APR farkını (kurulum, güven, AppleCare+, hizmet) değer üzerinden anlatırsa yumuşa. Zorlu ol." },
  { id: "iade", emoji: "😤", product: "Şikâyet / iade", kpi: "İtiraz Yönetimi", diff: "zor", name: "Ayşe", mood: "tereddut", brief: "Önceki deneyimi kötü, sinirli ve dirençli.", persona: "Sen Ayşe, 44. Daha önce bir cihazda sorun yaşadın, sinirli ve güvensiz geldin. Önce şikâyet ediyorsun. Temsilci seni dinler, empati kurar ve çözüm sunarsa sakinleş; savunmaya geçer ya da geçiştirirse daha da sinirlen. Sakinleşirsen yeni alışverişe açıl." },
  { id: "lansman", emoji: "🚀", product: "iPhone 17 lansman", kpi: "Premium Satış", diff: "orta", name: "Can", mood: "ilgili", brief: "Lansman haftası, heyecanlı ama kararsız (Pro mu, normal mi).", persona: "Sen Can, 28. iPhone 17 lansmanında heyecanlısın ama Pro mu normal mi kararsızsın. İtirazın yok ama yönlendirilmek istiyorsun. İhtiyacın (kamera, oyun, saklama) keşfedilip doğru modele + korumaya yönlendirilirse hızlı ikna ol." },
  { id: "cr", emoji: "🚶", product: "Vitrin müşterisi", kpi: "Dönüşüm (CR)", diff: "orta", name: "Burcu", mood: "supheci", brief: "Sadece bakıyor, 'şöyle bir bakıyorum' diyor; çıkmak üzere.", persona: "Sen Burcu, 33. Sadece vitrine bakıyorsun, almaya niyetin belirsiz. Temsilci seni etiketlemeden ihtiyacını keşfeder ve değer gösterirse kal; ısrarcı/robotik olursa 'sağ olun bakıyorum' deyip çıkmaya yönel (leave:true)." },
];

const SCENARIO_SYSTEM = `Apple Premium Reseller (Türkiye) için GERÇEKÇİ, çeşitli bir satış prova müşterisi üret. SADECE JSON: {"name":"isim","product":"ürün","kpi":"AppleCare+ Attach|Aksesuar Attach|Mac Upgrade|Trade-In|Finansman|Watch Attach|iPad Attach|Premium Satış","diff":"kolay|orta|zor","brief":"tek cümle","mood":"supheci|dusunuyor|tereddut|ilgili","emoji":"tek emoji","persona":"4-6 cümle, itirazlar dahil"}`;

const QUIZ = [
  { q: "AppleCare+ teklifi için en doğru an hangisi?", a: ["Müşteri vitrindeyken", "İhtiyaç keşfinden sonra", "Ödeme bittikten sonra"], c: 1 },
  { q: "Yüksek attach için en etkili yaklaşım?", a: ["Fiyat vurgusu", "İhtiyaç + fayda eşleştirme", "İndirim sözü"], c: 1 },
  { q: "Trade-in müşteriye anında ne sağlar?", a: ["Anında indirim/kredi", "6 ay sonra ödeme", "Sadece geri dönüşüm"], c: 0 },
  { q: "Finansman itirazında doğru çerçeve?", a: ["Aylık küçük tutara bölmek", "Pahalı olduğunu kabul edip geçmek", "Konuyu değiştirmek"], c: 0 },
  { q: "Premium satışta işlem değerini artıran?", a: ["Tek ürün", "Paket + koruma", "Sadece kampanya"], c: 1 },
  { q: "Rakip 'daha ucuz' itirazında en iyi cevap?", a: ["Hemen fiyat kırmak", "Değer farkını (hizmet, güven, koruma) anlatmak", "Tartışmak"], c: 1 },
];

const MOODS = {
  supheci: { label: "Şüpheci", emoji: "😐", text: "text-slate-600", bg: "bg-slate-100" },
  dusunuyor: { label: "Düşünüyor", emoji: "🤔", text: "text-amber-700", bg: "bg-amber-50" },
  tereddut: { label: "Tereddüt ediyor", emoji: "😟", text: "text-orange-700", bg: "bg-orange-50" },
  ilgili: { label: "İlgili", emoji: "🙂", text: "text-emerald-700", bg: "bg-emerald-50" },
  ikna: { label: "İkna oldu", emoji: "😄", text: "text-emerald-800", bg: "bg-emerald-100" },
};
const AV_COLORS = ["bg-indigo-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-fuchsia-500", "bg-teal-500"];

function levelInfo(xp = 0) {
  const per = 400, level = Math.floor(xp / per) + 1, into = xp - (level - 1) * per;
  const titles = ["Çırak", "Çırak", "Danışman", "Danışman", "Uzman", "Uzman", "Kıdemli", "Kıdemli", "Usta Koç"];
  return { level, pct: Math.round((into / per) * 100), into, per, title: titles[Math.min(level - 1, titles.length - 1)], nextXp: per - into };
}
const BADGES = [
  { id: "first", emoji: "🎯", label: "İlk Prova", cond: (r) => r.sessions >= 1 },
  { id: "five", emoji: "🔥", label: "5 Prova", cond: (r) => r.sessions >= 5 },
  { id: "ten", emoji: "🏃", label: "Maraton", cond: (r) => r.sessions >= 10 },
  { id: "master", emoji: "⭐", label: "Usta 90+", cond: (r) => r.bestScore >= 90 },
  { id: "streak", emoji: "🔥", label: "3 Gün Seri", cond: (r) => (r.streak || 0) >= 3 },
  { id: "versatile", emoji: "🧭", label: "Çok Yönlü", cond: (r) => Object.keys(r.perKpi || {}).length >= 3 },
];

const SEED = [
  { username: "Ahmet", bestScore: 94, sessions: 28, totalXp: 2240, color: "bg-indigo-500", store: "Kanyon", kpis: ["AppleCare+ Attach", "Mac Upgrade", "Finansman", "Premium Satış"] },
  { username: "Emre", bestScore: 91, sessions: 21, totalXp: 1760, color: "bg-rose-500", store: "Akasya", kpis: ["AppleCare+ Attach", "Trade-In", "Aksesuar Attach"] },
  { username: "Zeynep", bestScore: 89, sessions: 17, totalXp: 1380, color: "bg-violet-500", store: "Kanyon", kpis: ["Watch Attach", "iPad Attach"] },
  { username: "Burak", bestScore: 85, sessions: 12, totalXp: 940, color: "bg-amber-500", store: "İstinyePark", kpis: ["Mac Upgrade", "Finansman"] },
  { username: "Eda", bestScore: 82, sessions: 9, totalXp: 700, color: "bg-emerald-500", store: "Akasya", kpis: ["AppleCare+ Attach", "Watch Attach"] },
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
  const catalog = useMemo(() => [...BASE_CATALOG, ...custom], [custom]);

  useEffect(() => { (async () => {
    await seedIfNeeded();
    setCustom((await sget("cscn:list")) || []);
    const sess = await sget("session", false);
    if (sess && sess.username) { const rec = await sget(ukey(sess.username)); if (rec) { setManager(!!sess.manager); await load(sess.username); setScreen("app"); return; } }
    setScreen("auth");
  })(); }, []);

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
  if (screen === "auth") return <><Style /><Auth onAuthed={onAuthed} /></>;

  const myRank = board.findIndex((b) => b.username.toLowerCase() === user.username.toLowerCase()) + 1;
  const reload = () => load(user.username);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Style />
      <div className="mx-auto max-w-md px-4 pb-24 pt-5">
        <TopBar user={user} me={me} onLogout={logout} manager={manager} />
        {tab === "home" && <HomeTab user={user} me={me} board={board} myRank={myRank} catalog={catalog} onBoard={() => setTab("board")} onLaunch={(sc) => { window.__launch = sc; setTab("play"); }} />}
        {tab === "play" && <PracticeTab user={user} catalog={catalog} onFinish={reload} goHome={() => setTab("home")} />}
        {tab === "board" && <LeaderboardTab board={board} user={user} />}
        {tab === "profile" && <ProfileTab me={me} user={user} myRank={myRank} manager={manager} onBecomeManager={becomeManager} />}
        {tab === "mgr" && manager && <ManagerTab board={board} catalog={catalog} reload={reload} />}
      </div>
      <BottomNav tab={tab} setTab={setTab} manager={manager} />
    </div>
  );
}

function Style() { return <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes popIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}.fade-up{animation:fadeUp .3s ease both}.pop-in{animation:popIn .3s ease both}@keyframes skBlink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}@keyframes skTalk{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1.05)}}@keyframes skBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}.sk-eyes{transform-box:fill-box;transform-origin:center;animation:skBlink 4.2s infinite}.sk-talk{transform-box:fill-box;transform-origin:center;animation:skTalk .26s infinite}.sk-bob{animation:skBob 3.6s ease-in-out infinite}` }} />; }

const FACE = {
  supheci:   { browL: "M38 47 L52 49", browR: "M68 49 L82 47", mouth: "M48 82 Q60 82 72 82" },
  dusunuyor: { browL: "M38 45 L52 47", browR: "M68 49 L82 51", mouth: "M52 83 Q60 81 68 83" },
  tereddut:  { browL: "M38 50 L52 45", browR: "M68 45 L82 50", mouth: "M48 86 Q60 80 72 86" },
  ilgili:    { browL: "M38 46 L52 47", browR: "M68 47 L82 46", mouth: "M48 80 Q60 88 72 80" },
  ikna:      { browL: "M38 44 L52 45", browR: "M68 45 L82 44", mouth: "M46 79 Q60 93 74 79" },
};
function CharacterFace({ mood = "supheci", talking, thinking }) {
  const f = FACE[mood] || FACE.supheci;
  return (
    <svg viewBox="0 0 120 124" className="h-full w-full">
      <path d="M18 124 Q18 96 60 96 Q102 96 102 124 Z" fill="#6366f1" />
      <rect x="52" y="84" width="16" height="14" rx="6" fill="#f3c9a8" />
      <circle cx="60" cy="56" r="38" fill="#fadcc0" />
      <path d="M22 54 Q22 16 60 16 Q98 16 98 54 Q98 40 82 36 Q70 30 60 30 Q50 30 38 36 Q22 40 22 54 Z" fill="#3f3f46" />
      <circle cx="23" cy="58" r="6" fill="#fadcc0" /><circle cx="97" cy="58" r="6" fill="#fadcc0" />
      <g className="sk-eyes">
        <ellipse cx="47" cy="58" rx="6" ry="7" fill="#fff" /><circle cx="48" cy="59" r="3" fill="#27272a" />
        <ellipse cx="73" cy="58" rx="6" ry="7" fill="#fff" /><circle cx="72" cy="59" r="3" fill="#27272a" />
      </g>
      <path d={f.browL} stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={f.browR} stroke="#3f3f46" strokeWidth="3" strokeLinecap="round" fill="none" />
      {talking
        ? <ellipse className="sk-talk" cx="60" cy="82" rx="8" ry="6" fill="#7f1d1d" />
        : <path d={f.mouth} stroke="#7f1d1d" strokeWidth="3.5" strokeLinecap="round" fill="none" />}
      {thinking && <g><circle cx="93" cy="30" r="3" fill="#cbd5e1" /><circle cx="101" cy="24" r="2.2" fill="#cbd5e1" /><circle cx="107" cy="19" r="1.6" fill="#cbd5e1" /></g>}
    </svg>
  );
}

function TopBar({ user, me, onLogout, manager }) {
  const lv = levelInfo(me?.totalXp || 0);
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600"><Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} /></div><div><div className="text-[15px] font-bold leading-tight tracking-tight">Satış Koçu</div><div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">{manager ? "Yönetici · Panel" : `Lv ${lv.level} · ${lv.title}`}</div></div></div>
      <button onClick={onLogout} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">{user.username} <LogOut className="h-3 w-3 text-slate-400" /></button>
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

function HomeTab({ user, me, board, myRank, catalog, onBoard, onLaunch }) {
  const lv = levelInfo(me?.totalXp || 0);
  const top3 = board.slice(0, 3);
  const daily = catalog[new Date().getDate() % catalog.length];
  const dailyDone = me?.dailyDone === todayStr();
  const hw = me?.homework ? catalog.find((s) => s.id === me.homework.scenarioId) : null;
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white shadow-md fade-up">
        <div className="flex items-center justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">Seviye {lv.level} · {lv.title}</div><div className="mt-1 text-3xl font-bold tracking-tight">{me?.bestScore || 0}<span className="ml-1 text-sm font-medium text-slate-400">en iyi</span></div></div><div className="space-y-1 text-right"><div className="flex items-center justify-end gap-1 text-amber-300"><Zap className="h-4 w-4" /><span className="text-lg font-bold">{me?.totalXp || 0}</span></div><div className="flex items-center justify-end gap-1 text-orange-300"><Flame className="h-3.5 w-3.5" /><span className="text-xs font-bold">{me?.streak || 0} gün</span></div></div></div>
        <div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>Lv {lv.level}</span><span>{lv.nextXp} XP kaldı</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${lv.pct}%` }} /></div></div>
      </div>

      {hw && <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 fade-up"><div className="flex items-center gap-2.5"><span className="text-xl">{hw.emoji}</span><div><div className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Yöneticinden ödev</div><div className="text-sm font-semibold text-amber-900">{hw.kpi}</div></div></div><button onClick={() => onLaunch(hw)} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">Başla</button></div>}

      <button onClick={() => !dailyDone && onLaunch({ ...daily, daily: true })} className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 fade-up ${dailyDone ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-white ring-1 ring-slate-200 hover:ring-indigo-300"}`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${dailyDone ? "bg-emerald-100" : "bg-indigo-50"}`}>{dailyDone ? <Check className="h-5 w-5 text-emerald-600" /> : <CalendarDays className="h-5 w-5 text-indigo-600" />}</div><div className="text-left"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Günün Provası {!dailyDone && "· +30 XP"}</div><div className="text-sm font-bold">{dailyDone ? "Bugün tamamlandı 🎉" : `${daily.emoji} ${daily.kpi}`}</div></div></div>{!dailyDone && <ArrowRight className="h-5 w-5 text-slate-400" />}</button>

      <div className="grid grid-cols-3 gap-3"><Stat label="Sıralama" value={myRank ? "#" + myRank : "—"} accent /><Stat label="Prova" value={me?.sessions || 0} /><Stat label="Dönüşüm" value={convPct(me)} /></div>

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

function ProfileTab({ me, user, myRank, manager, onBecomeManager }) {
  const lv = levelInfo(me?.totalXp || 0);
  const earned = BADGES.map((b) => ({ ...b, got: b.cond(me || {}) }));
  const kpis = Object.entries(me?.perKpi || {});
  const recent = (me?.recent || []).slice(-8);
  const [code, setCode] = useState(""), [showCode, setShowCode] = useState(false), [cerr, setCerr] = useState("");
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 fade-up">
        <div className="flex items-center gap-4"><Avatar name={user.username} color={me?.avatarColor} size="h-16 w-16" text="text-xl" /><div><div className="text-lg font-bold">{user.username}</div><div className="text-sm font-semibold text-indigo-600">Lv {lv.level} · {lv.title}</div><div className="text-xs text-slate-400">#{myRank || "—"} · {me?.store || "—"} · 🔥{me?.streak || 0} gün</div></div></div>
        <div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>{me?.totalXp || 0} XP</span><span>Lv {lv.level + 1}'e {lv.nextXp} XP</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${lv.pct}%` }} /></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><div className="text-lg font-bold text-emerald-600">{me?.outcomes?.won || 0}</div><div className="text-[10px] text-slate-400">Kazanılan</div></div><div><div className="text-lg font-bold text-rose-500">{me?.outcomes?.lost || 0}</div><div className="text-[10px] text-slate-400">Kaybedilen</div></div><div><div className="text-lg font-bold text-indigo-600">{convPct(me)}</div><div className="text-[10px] text-slate-400">Dönüşüm</div></div></div>
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
  async function genAI() { setGenBusy(true); try { const s = looseJSON(await callClaude(SCENARIO_SYSTEM, [{ role: "user", content: "Yeni, farklı bir senaryo üret." }])); s.id = "ai-" + Date.now(); setScenario(s); setView("play"); } catch { setScenario(catalog[Math.floor(Math.random() * catalog.length)]); setView("play"); } setGenBusy(false); }
  if (view === "quiz") return <Quiz user={user} onDone={() => { onFinish(); setView("pick"); }} onBack={() => setView("pick")} />;
  if (view === "play" && scenario) return <Roleplay user={user} scenario={scenario} onResult={(fb) => { setFeedback(fb); setView("result"); onFinish(); }} onQuit={() => setView("pick")} />;
  if (view === "result" && feedback) return <Result fb={feedback} scenario={scenario} onAgain={() => setView("pick")} onHome={goHome} />;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold tracking-tight">Senaryo seç</h1><p className="text-sm text-slate-500">Müşteri seç, yapay zekâ üretsin ya da quiz çöz.</p></div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={genAI} disabled={genBusy} className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 px-4 py-3.5 text-left text-white disabled:opacity-60"><Dices className="h-5 w-5 shrink-0" /><div><div className="text-[13px] font-bold">AI senaryo</div><div className="text-[10px] text-indigo-200">benzersiz</div></div>{genBusy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}</button>
        <button onClick={() => setView("quiz")} className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-3.5 text-left text-white"><BookOpen className="h-5 w-5 shrink-0" /><div><div className="text-[13px] font-bold">Bilgi Quizi</div><div className="text-[10px] text-emerald-100">+XP</div></div></button>
      </div>
      <div className="grid grid-cols-2 gap-3">{catalog.map((s) => <button key={s.id} onClick={() => { setScenario(s); setView("play"); }} className="flex flex-col items-start rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200 transition hover:shadow-md hover:ring-indigo-300"><div className="flex w-full items-center justify-between"><span className="text-2xl">{s.emoji}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF[s.diff].cls}`}>{DIFF[s.diff].label}</span></div><div className="mt-2 text-[13px] font-bold leading-tight">{s.kpi}</div><div className="mt-0.5 text-[11px] text-slate-400">{s.product}</div><div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500"><User className="h-3 w-3" /> {s.name}{s.custom && <span className="ml-1 rounded bg-indigo-50 px-1 text-[9px] text-indigo-600">özel</span>}</div></button>)}</div>
    </div>
  );
}

function buildCustomerSystem(s) {
  return `Sen bir Apple Premium Reseller mağazasında (Türkiye) alışveriş yapan GERÇEKÇİ bir müşterisin.
${s.persona}
KURALLAR: Asla satıcı gibi davranma, sadece müşteri ol. Kısa konuş (1-3 cümle). Baskıya diren, iyi keşif+somut faydaya yumuşa. Yeterince ikna olursan satın al: "done":true. Kötü yönetilirsen ya da senaryon gerektiriyorsa vazgeçip çık: "leave":true.
Her yanıtında SADECE JSON: {"reply":"...","emotion":"ilgili|dusunuyor|tereddut|supheci|ikna","done":false,"leave":false}`;
}

function Roleplay({ user, scenario, onResult, onQuit }) {
  const [turns, setTurns] = useState([]); const [mood, setMood] = useState(scenario.mood || "supheci"); const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false); const [scoring, setScoring] = useState(false); const [ended, setEnded] = useState(null);
  const [err, setErr] = useState(""); const [ready, setReady] = useState(false); const [voiceMode, setVoiceMode] = useState(false); const [listening, setListening] = useState(false);
  const [hint, setHint] = useState(""); const [hintBusy, setHintBusy] = useState(false);
  const [talking, setTalking] = useState(false);
  const ref = useRef(null), recogRef = useRef(null), apiRef = useRef([]), voiceRef = useRef(false), endedRef = useRef(false), thinkingRef = useRef(false), talkTimer = useRef(null);
  function pulseTalk(ms = 1400) { setTalking(true); if (talkTimer.current) clearTimeout(talkTimer.current); talkTimer.current = setTimeout(() => setTalking(false), ms); }
  function sayOut(text, then) { setTalking(true); speak(text, () => { setTalking(false); then && then(); }); }
  useEffect(() => { const last = turns[turns.length - 1]; if (last && last.who === "c" && !voiceRef.current) pulseTalk(Math.min(4500, 900 + (last.text ? last.text.length : 0) * 38)); }, [turns]);
  useEffect(() => { voiceRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { endedRef.current = !!ended; }, [ended]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);
  useEffect(() => { (async () => {
    const msgs = [{ role: "user", content: "(Sahne başlıyor. Müşteri olarak doğal bir açılış cümlesi söyle.)" }];
    try { const raw = await callClaude(buildCustomerSystem(scenario), msgs); const p = looseJSON(raw); apiRef.current = [...msgs, { role: "assistant", content: raw }]; setTurns([{ who: "c", text: p.reply, emotion: p.emotion }]); setMood(p.emotion || scenario.mood); }
    catch { apiRef.current = msgs; setTurns([{ who: "c", text: "Merhaba, biraz bakınıyordum.", emotion: scenario.mood }]); }
    setReady(true);
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
      if (voiceRef.current) sayOut(p.reply, () => { if (voiceRef.current && !endedRef.current) startListen(); });
    } catch { setErr("Yanıt alınamadı, tekrar gönder."); }
    setThinking(false); thinkingRef.current = false;
  }
  async function getHint() {
    if (hintBusy || endedRef.current) return; setHintBusy(true);
    const tr = turns.map((t) => (t.who === "r" ? "Temsilci: " : "Müşteri: ") + t.text).join("\n");
    try { const h = await callClaude(`Sen bir satış koçusun. KPI: ${scenario.kpi}. Konuşmaya bakıp temsilciye SADECE tek cümlelik uygulanabilir taktik ipucu ver. Tırnak yok.`, [{ role: "user", content: tr || "(henüz konuşma yok)" }]); setHint(h.trim().slice(0, 200)); } catch { setHint("İhtiyacı keşfet, sonra faydayı somut anlat."); }
    setHintBusy(false);
  }
  function startListen() {
    if (!SR || thinkingRef.current || endedRef.current) return;
    try {
      const rec = new SR(); rec.lang = "tr-TR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1; let finalText = "";
      rec.onresult = (e) => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += tr; else it += tr; } setInput((finalText + it).trim()); };
      rec.onerror = () => setListening(false);
      rec.onend = () => { setListening(false); const t = finalText.trim(); if (t) { if (voiceRef.current) doSend(t); else setInput(t); } };
      recogRef.current = rec; setListening(true); rec.start();
    } catch { setListening(false); }
  }
  function stopListen() { try { recogRef.current && recogRef.current.stop(); } catch {} setListening(false); }
  function toggleVoice() {
    const nv = !voiceMode; setVoiceMode(nv); voiceRef.current = nv;
    if (!nv) { try { synth && synth.cancel(); } catch {} stopListen(); }
    else { const last = [...turns].reverse().find((t) => t.who === "c"); if (last) sayOut(last.text, () => { if (voiceRef.current && !endedRef.current) startListen(); }); }
  }
  async function finish() {
    const reps = turns.filter((t) => t.who === "r").length; if (scoring || reps < 1) return;
    try { synth && synth.cancel(); } catch {} stopListen(); setScoring(true); setErr("");
    const tr = turns.map((t) => (t.who === "r" ? "Temsilci: " : "Müşteri: ") + t.text).join("\n");
    const sys = `Gürgençler (Apple Premium Reseller) satış koçusun. KPI: ${scenario.kpi}. Transkripti İhtiyaç Keşfi, Teklif Zamanlaması, Değer İletişimi, İtiraz Yönetimi, Kapanış başlıklarında 0-100 puanla. Yapıcı Türk koç tonu. SADECE JSON: {"score":0-100,"stars":0-5,"headline":"...","kpis":[{"name":"İhtiyaç Keşfi","score":0},{"name":"Teklif Zamanlaması","score":0},{"name":"Değer İletişimi","score":0},{"name":"İtiraz Yönetimi","score":0},{"name":"Kapanış","score":0}],"strengths":["..."],"improvements":["..."],"suggestions":["..."]}`;
    try {
      const fb = looseJSON(await callClaude(sys, [{ role: "user", content: "TRANSKRİPT:\n\n" + tr }]));
      const outcome = ended || "lost";
      const rec = (await sget(skey(user.username))) || { username: user.username, bestScore: 0, sessions: 0, totalXp: 0, perKpi: {}, recent: [], outcomes: { won: 0, lost: 0 } };
      const today = todayStr();
      if (rec.lastPlayedDate === today) {} else if (rec.lastPlayedDate === yesterdayStr()) rec.streak = (rec.streak || 0) + 1; else rec.streak = 1;
      rec.lastPlayedDate = today;
      let bonus = 0; if (scenario.daily && rec.dailyDone !== today) { bonus = 30; rec.dailyDone = today; }
      rec.bestScore = Math.max(rec.bestScore || 0, fb.score); rec.sessions = (rec.sessions || 0) + 1; rec.totalXp = (rec.totalXp || 0) + fb.score + bonus;
      rec.perKpi = rec.perKpi || {}; const pk = rec.perKpi[scenario.kpi] || { best: 0, sessions: 0 }; rec.perKpi[scenario.kpi] = { best: Math.max(pk.best, fb.score), sessions: pk.sessions + 1 };
      rec.outcomes = rec.outcomes || { won: 0, lost: 0 }; rec.outcomes[outcome] = (rec.outcomes[outcome] || 0) + 1;
      rec.recent = [...(rec.recent || []), { score: fb.score, kpi: scenario.kpi, ts: Date.now() }].slice(-12);
      if (rec.homework && rec.homework.scenarioId === scenario.id) rec.homework = null;
      await sset(skey(user.username), rec);
      onResult({ ...fb, outcome });
    } catch { setErr("Skorlama yapılamadı, tekrar dene."); }
    setScoring(false);
  }
  const reps = turns.filter((t) => t.who === "r").length;
  if (!ready) return <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-slate-200"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" /><p className="mt-3 text-sm text-slate-500">Müşteri hazırlanıyor…</p></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><button onClick={() => { try { synth && synth.cancel(); } catch {} stopListen(); onQuit(); }} className="text-sm font-semibold text-slate-500">← Vazgeç</button><button onClick={toggleVoice} disabled={!SR && !synth} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${voiceMode ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"} disabled:opacity-40`}>{voiceMode ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Sesli mod</button></div>
      <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white"><Target className="h-3 w-3" /> {scenario.kpi}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF[scenario.diff || "orta"].cls}`}>{DIFF[scenario.diff || "orta"].label}</span></div><p className="mt-2 text-[13px] leading-snug text-slate-600">{scenario.brief}</p></div>
      <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
        <div className={`sk-bob h-16 w-16 shrink-0 overflow-hidden rounded-2xl ${MOODS[mood]?.bg}`}><CharacterFace mood={mood} talking={talking} thinking={thinking} /></div>
        <div className="min-w-0 flex-1"><div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{scenario.name} · {scenario.product}</div><div className={`text-base font-bold ${MOODS[mood]?.text}`}>{MOODS[mood]?.label}</div><div className="mt-0.5 text-[11px] font-medium text-slate-400">{talking ? "konuşuyor…" : thinking ? "düşünüyor…" : "dinliyor"}</div></div>
        <div className="text-right"><div className="text-[10px] text-slate-400">tur</div><div className="text-sm font-bold text-slate-700">{reps}</div></div>
      </div>
      <div ref={ref} className="h-[34vh] min-h-[200px] space-y-3 overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        {turns.map((t, i) => t.who === "c" ? (
          <div key={i} className="flex items-end gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">{MOODS[t.emotion]?.emoji || "🙂"}</div><div className="max-w-[80%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-800">{t.text}<button onClick={() => sayOut(t.text)} title="Dinle" className="ml-1.5 inline-flex translate-y-0.5 text-slate-400 hover:text-indigo-600"><Volume2 className="h-3.5 w-3.5" /></button></div></div>
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
      <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200"><div className="flex items-end gap-2"><button onClick={() => { if (listening) stopListen(); else startListen(); }} disabled={!SR || thinking || !!ended} title={SR ? "Konuşmak için bas" : "Tarayıcı desteklemiyor"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-30 ${listening ? "animate-pulse bg-rose-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}><Mic className="h-4 w-4" /></button><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(input); } }} rows={1} disabled={thinking || !!ended} placeholder={ended ? "Konuşma bitti" : listening ? "Dinliyorum…" : "Yaz ya da mikrofona bas…"} className="max-h-24 flex-1 resize-none bg-transparent px-1 py-2 text-[14px] outline-none placeholder:text-slate-400 disabled:opacity-50" /><button onClick={() => doSend(input)} disabled={thinking || !!ended || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white disabled:opacity-30"><Send className="h-4 w-4" /></button></div></div>
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
        <div className="flex items-center gap-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-indigo-50 px-5 py-5"><div className="relative h-[88px] w-[88px] shrink-0"><svg className="h-full w-full -rotate-90" viewBox="0 0 80 80"><circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" /><circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .9s ease" }} /></svg><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold tracking-tight">{pct}</span><span className="text-[10px] text-slate-400">/100</span></div></div><div><div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((i) => { const fl = i < full ? 1 : i === full && half ? 0.5 : 0; return <span key={i} className="relative text-base"><span className="text-slate-200">★</span><span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fl * 100}%` }}>★</span></span>; })}</div><div className="mt-1.5 text-lg font-bold leading-tight tracking-tight">{f.headline}</div><div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold"><span className="flex items-center gap-1 text-amber-600"><Zap className="h-3 w-3" /> +{pct} XP</span>{fb.outcome === "won" ? <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">Kazanıldı</span> : <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-600">Kaybedildi</span>}</div></div></div>
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

function Quiz({ user, onDone, onBack }) {
  const [i, setI] = useState(0), [picked, setPicked] = useState(null), [score, setScore] = useState(0), [done, setDone] = useState(false);
  const q = QUIZ[i];
  function choose(idx) {
    if (picked !== null) return; setPicked(idx); const correct = idx === q.c; if (correct) setScore((s) => s + 1);
    setTimeout(async () => { if (i + 1 < QUIZ.length) { setI(i + 1); setPicked(null); } else { setDone(true); const rec = await sget(skey(user.username)); if (rec) { rec.totalXp = (rec.totalXp || 0) + (score + (correct ? 1 : 0)) * 10; await sset(skey(user.username), rec); } } }, 700);
  }
  if (done) return <div className="space-y-4"><div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 pop-in"><div className="text-4xl font-bold tracking-tight">{score}/{QUIZ.length}</div><div className="mt-1 text-sm text-slate-500">doğru · +{score * 10} XP</div></div><button onClick={onDone} className="w-full rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 px-5 py-3.5 text-[15px] font-semibold text-white">Bitir</button></div>;
  return (
    <div className="space-y-4"><button onClick={onBack} className="text-sm font-semibold text-slate-500">← Geri</button><div className="flex items-center justify-between text-xs font-semibold text-slate-400"><span>Soru {i + 1}/{QUIZ.length}</span><span>{score} doğru</span></div><div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><div className="text-base font-bold leading-snug">{q.q}</div><div className="mt-4 space-y-2">{q.a.map((opt, idx) => { let cls = "bg-slate-50 ring-slate-200"; if (picked !== null) { if (idx === q.c) cls = "bg-emerald-50 ring-emerald-300"; else if (idx === picked) cls = "bg-rose-50 ring-rose-300"; } return <button key={idx} onClick={() => choose(idx)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-medium ring-1 ${cls}`}>{opt}{picked !== null && idx === q.c && <Check className="h-4 w-4 text-emerald-600" />}</button>; })}</div></div></div>
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
  const [ns, setNs] = useState({ name: "", product: "", kpi: "AppleCare+ Attach", diff: "orta", emoji: "📱", brief: "", persona: "", mood: "supheci" });
  const selRec = team.find((r) => r.username === sel);

  function downloadTemplate() {
    const rows = [["Satici", "KPI", "Gercek", "Hedef"], ["ugur", "AppleCare+ Attach", 18, 25], ["ugur", "Aksesuar Attach", 32, 40], ["Ahmet", "Mac Upgrade", 22, 30]];
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

function BottomNav({ tab, setTab, manager }) {
  const items = [{ id: "home", icon: HomeIcon, label: "Ana" }, { id: "play", icon: Swords, label: "Prova" }, { id: "board", icon: Trophy, label: "Lider" }];
  if (manager) items.push({ id: "mgr", icon: Users, label: "Yönetici" });
  items.push({ id: "profile", icon: User, label: "Profil" });
  return <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-md items-center justify-around px-1 py-2">{items.map((it) => { const Icon = it.icon, active = tab === it.id; return <button key={it.id} onClick={() => setTab(it.id)} className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 ${active ? "text-indigo-600" : "text-slate-400"}`}><Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} /><span className="text-[10px] font-semibold">{it.label}</span></button>; })}</div></div>;
}
