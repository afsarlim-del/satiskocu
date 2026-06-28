const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (req) => {
  try {
    const { system, messages } = await req.json();
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const key = process.env.GEMINI_API_KEY;
    if (!key) return json({ text: "", error: "GEMINI_API_KEY tanımlı değil" }, 500);

    const contents = (messages || []).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 2048, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
    };
    if (system) body.system_instruction = { parts: [{ text: system }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) break;
      if (res.status === 429 || res.status >= 500) { await sleep(1500); continue; }
      break;
    }

    const data = await res.json();
    if (data.error) return json({ text: "", error: data.error.message || "gemini error" }, 500);

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    if (!text) return json({ text: "", error: "boş yanıt (hız sınırı olabilir)" }, 500);
    return json({ text });
  } catch (e) {
    return json({ text: "", error: String(e) }, 500);
  }
};
