// Cloudflare Pages Function — global anahtar-değer depo (Cloudflare KV).
// KV namespace'i panelden "SATISKOCU_KV" adıyla bağlanmalı.
// İstemci bu fonksiyonu /api/storage olarak çağırır.

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const kv = env.SATISKOCU_KV;
    if (!kv) return json({ error: "KV deposu bağlı değil (SATISKOCU_KV)" }, 500);

    const { op, key, value, prefix } = await request.json();

    if (op === "get") {
      const v = await kv.get(key);
      return json({ value: v ? JSON.parse(v) : null });
    }
    if (op === "set") {
      await kv.put(key, JSON.stringify(value));
      return json({ ok: true });
    }
    if (op === "list") {
      const r = await kv.list({ prefix: prefix || "" });
      return json({ keys: (r.keys || []).map((k) => k.name) });
    }
    return json({ error: "bad op" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
