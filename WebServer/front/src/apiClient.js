import { env } from "./env.js";

function buildApiUrl(path) {
  const base = env.apiBaseUrl;
  if (!base) {
    throw new Error("VITE_API_BASE_URL manquant");
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function getJson(path) {
  const res = await fetch(buildApiUrl(path));
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
  return res.json();
}

export async function postJson(path, body) {
  const res = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
  return res.json().catch(() => ({ ok: true }));
}
