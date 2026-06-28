const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

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
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };
    if (system) body.system_instruction = { parts: [{ text: system }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    if (data.error) return json({ text: "", error: data.error.message || "gemini error" }, 500);

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    return json({ text });
  } catch (e) {
    return json({ text: "", error: String(e) }, 500);
  }
};
