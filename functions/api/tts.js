// Cloudflare Pages Function — OpenAI metin-ses (TTS) proxy'si.
// Anahtar yalnızca sunucuda; tarayıcıya inmez. İstemci /api/tts olarak çağırır.
// OPENAI_API_KEY yoksa 501 döner; istemci tarayıcı sesine düşer.

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "tts yok" }), { status: 501, headers: { "content-type": "application/json" } });
    }
    const { text, voice, speed } = await request.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "boş" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL || "tts-1",
        voice: voice || "nova",
        input: String(text).slice(0, 800),
        response_format: "mp3",
        speed: Math.max(0.5, Math.min(2, speed || 1)),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: t.slice(0, 200) }), { status: res.status, headers: { "content-type": "application/json" } });
    }
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
