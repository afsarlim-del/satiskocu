// Cloudflare Pages Function — çoklu sağlayıcı metin-ses (TTS).
// Öncelik: ElevenLabs -> Azure -> OpenAI. Hangi anahtar tanımlıysa o kullanılır.
// Anahtarlar yalnızca sunucuda; tarayıcıya inmez. İstemci /api/tts olarak çağırır.
// Tarayıcıda GET açarsan hangi sağlayıcının tanımlı olduğunu (gizlisiz) gösterir.

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const isFemale = (v) => /nova|shimmer|female|fable|kad|emel/i.test(v || "");
function escapeXml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }

async function viaElevenLabs(env, text, fem) {
  const vid = fem ? (env.ELEVEN_VOICE_F || "21m00Tcm4TlvDq8ikWAM") : (env.ELEVEN_VOICE_M || "pNInz6obpgDQGcFmaJgB");
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 800), model_id: env.ELEVEN_MODEL || "eleven_multilingual_v2" }),
  });
}
async function viaAzure(env, text, fem, speed) {
  const region = env.AZURE_SPEECH_REGION || "westeurope";
  const voice = fem ? (env.AZURE_VOICE_F || "tr-TR-EmelNeural") : (env.AZURE_VOICE_M || "tr-TR-AhmetNeural");
  const rate = Math.round(((speed || 1) - 1) * 100);
  const ssml = `<speak version='1.0' xml:lang='tr-TR'><voice xml:lang='tr-TR' name='${voice}'><prosody rate='${rate >= 0 ? "+" : ""}${rate}%'>${escapeXml(text.slice(0, 800))}</prosody></voice></speak>`;
  return fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "satiskocu" },
    body: ssml,
  });
}
async function viaOpenAI(env, text, fem, speed) {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + env.OPENAI_API_KEY },
    body: JSON.stringify({ model: env.OPENAI_TTS_MODEL || "tts-1", voice: fem ? "nova" : "onyx", input: text.slice(0, 800), response_format: "mp3", speed: Math.max(0.5, Math.min(2, speed || 1)) }),
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  return json({ elevenlabs: !!env.ELEVENLABS_API_KEY, azure: !!env.AZURE_SPEECH_KEY, openai: !!env.OPENAI_API_KEY });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { text, voice, speed } = await request.json();
    if (!text || !text.trim()) return json({ error: "boş" }, 400);
    const fem = isFemale(voice);

    let provider, res;
    if (env.ELEVENLABS_API_KEY) { provider = "elevenlabs"; res = await viaElevenLabs(env, text, fem); }
    else if (env.AZURE_SPEECH_KEY) { provider = "azure"; res = await viaAzure(env, text, fem, speed); }
    else if (env.OPENAI_API_KEY) { provider = "openai"; res = await viaOpenAI(env, text, fem, speed); }
    else return json({ error: "tts anahtarı yok" }, 501);

    if (!res.ok) { const t = await res.text(); return json({ error: provider + ": " + t.slice(0, 200) }, res.status); }
    const buf = await res.arrayBuffer();
    return new Response(buf, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store", "x-tts-provider": provider } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
