// Tüm yapay zekâ ve depo çağrıları buradan geçer.
// callClaude -> Netlify Function (anahtar sunucuda gizli)
// sget/sset/slist -> shared:true ise global depo (Netlify Blobs), değilse cihazda localStorage

async function post(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

export async function callClaude(system, messages) {
  const r = await post("/.netlify/functions/claude", { system, messages });
  if (r.error) throw new Error(r.error);
  return r.text || "";
}

export async function sget(key, shared = true) {
  if (!shared) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  }
  try { const r = await post("/.netlify/functions/storage", { op: "get", key }); return r.value ?? null; } catch { return null; }
}

export async function sset(key, value, shared = true) {
  if (!shared) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  try { await post("/.netlify/functions/storage", { op: "set", key, value }); return true; } catch { return false; }
}

export async function slist(prefix, shared = true) {
  if (!shared) return [];
  try { const r = await post("/.netlify/functions/storage", { op: "list", prefix }); return r.keys || []; } catch { return []; }
}
