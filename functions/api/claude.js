// Cloudflare Pages Function — çok-sağlayıcılı yapay zekâ proxy'si.
// Sırayla dener: Gemini -> Groq -> (varsa) OpenRouter -> (varsa) Mistral.
// Anahtarlar yalnızca burada (ortam değişkenleri) okunur, tarayıcıya HİÇ inmez.
// İstemci bu fonksiyonu /api/claude olarak çağırır.

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryFetch(url, opts) {
  let res;
  for (let i = 0; i < 3; i++) {
    res = await fetch(url, opts);
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) { await sleep(1200); continue; }
    return res;
  }
  return res;
}

async function callGemini(env, system, messages, temp = 0.7) {
  const key = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));
  const body = { contents, generationConfig: { maxOutputTokens: 2048, temperature: temp, thinkingConfig: { thinkingBudget: 0 } } };
  if (system) body.system_instruction = { parts: [{ text: system }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await tryFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "gemini error");
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

async function callOpenAICompat(base, key, model, system, messages, temp = 0.7) {
  const msgs = [];
  if (system) msgs.push({ role: "system", content: system });
  for (const m of messages) msgs.push({ role: m.role === "assistant" ? "assistant" : "user", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
  const res = await tryFetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + key },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 1024, temperature: temp }),
  });
  const data = await res.json();
  if (data.error) throw new Error((data.error.message || data.error) + "");
  return data.choices?.[0]?.message?.content || "";
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { system, messages, temperature } = await request.json();
    const temp = typeof temperature === "number" ? Math.max(0, Math.min(1.3, temperature)) : 0.7;

    const chain = [];
    if (env.OPENAI_API_KEY) chain.push({ name: "openai", fn: () => callOpenAICompat("https://api.openai.com/v1", env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4o-mini", system, messages, temp) });
    if (env.GEMINI_API_KEY) chain.push({ name: "gemini", fn: () => callGemini(env, system, messages, temp) });
    if (env.GROQ_API_KEY) chain.push({ name: "groq", fn: () => callOpenAICompat("https://api.groq.com/openai/v1", env.GROQ_API_KEY, env.GROQ_MODEL || "llama-3.3-70b-versatile", system, messages, temp) });
    if (env.OPENROUTER_API_KEY && env.OPENROUTER_MODEL) chain.push({ name: "openrouter", fn: () => callOpenAICompat("https://openrouter.ai/api/v1", env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL, system, messages, temp) });
    if (env.MISTRAL_API_KEY) chain.push({ name: "mistral", fn: () => callOpenAICompat("https://api.mistral.ai/v1", env.MISTRAL_API_KEY, env.MISTRAL_MODEL || "mistral-small-latest", system, messages, temp) });

    if (!chain.length) return json({ text: "", error: "Hiç API anahtarı tanımlı değil (OPENAI_API_KEY, GEMINI_API_KEY ya da GROQ_API_KEY ekle)" }, 500);

    const errs = [];
    for (const p of chain) {
      try {
        const text = await p.fn();
        if (text && text.trim()) return json({ text, provider: p.name });
        errs.push(p.name + ": boş yanıt");
      } catch (e) {
        errs.push(p.name + ": " + String(e.message || e));
      }
    }
    return json({ text: "", error: "Tüm sağlayıcılar başarısız → " + errs.join(" | ") }, 500);
  } catch (e) {
    return json({ text: "", error: String(e) }, 500);
  }
}
