// Global anahtar-değer depo (liderlik tablosu, kullanıcılar, senaryolar).
// Netlify Blobs kullanır; deploy edildiğinde otomatik çalışır.
import { getStore } from "@netlify/blobs";

const j = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });

export default async (req) => {
  try {
    const { op, key, value, prefix } = await req.json();
    const store = getStore("satiskocu");
    if (op === "get") {
      const v = await store.get(key, { type: "json" });
      return j({ value: v ?? null });
    }
    if (op === "set") {
      await store.setJSON(key, value);
      return j({ ok: true });
    }
    if (op === "list") {
      const res = await store.list({ prefix: prefix || "" });
      return j({ keys: (res.blobs || []).map((b) => b.key) });
    }
    return j({ error: "bad op" }, 400);
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
};
