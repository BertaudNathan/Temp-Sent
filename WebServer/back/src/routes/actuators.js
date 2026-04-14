import express from "express";
import { config } from "../config.js";

function buildUrl(baseUrl, path) {
  const baseRaw = String(baseUrl || "").trim();
  if (!baseRaw) {
    throw new Error("RASPBERRY_CONTROL_BASE_URL manquant");
  }

  const baseWithScheme =
    baseRaw.startsWith("http://") || baseRaw.startsWith("https://") ? baseRaw : `http://${baseRaw}`;
  const base = baseWithScheme.replace(/\/+$/, "");
  try {
    // eslint-disable-next-line no-new
    new URL(base);
  } catch {
    throw new Error(`RASPBERRY_CONTROL_BASE_URL invalide: ${baseRaw}`);
  }

  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function normalizeCommand(body) {
  const command = String(body?.command || "").trim().toLowerCase();
  if (!command) {
    throw new Error("command requis");
  }

  if (command === "on" || command === "off" || command === "reset" || command === "emergency_stop") {
    return { command };
  }

  if (command === "set_motor") {
    const value = Number(body?.value);
    if (!Number.isFinite(value)) {
      throw new Error("value requis pour set_motor");
    }
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return { command: "set_motor", value: clamped };
  }

  throw new Error(`command inconnue: ${command}`);
}

async function postJsonWithTimeout(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, raw: text };
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Timeout apres ${timeoutMs}ms vers Raspberry control: ${url}`);
    }

    const cause = err?.cause;
    const details = [cause?.code, cause?.message].filter(Boolean).join(" ").trim();
    if (err?.message === "fetch failed") {
      throw new Error(`Fetch failed vers Raspberry control: ${url}${details ? ` - ${details}` : ""}`);
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function createActuatorsRouter() {
  const router = express.Router();

  router.post("/actuators/:id/command", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        res.status(400).json({ ok: false, error: "actuator id requis" });
        return;
      }

      const cmd = normalizeCommand(req.body);
      const url = buildUrl(config.raspberry.controlBaseUrl, `/api/v1/actuators/${encodeURIComponent(id)}/command`);

      const result = await postJsonWithTimeout(url, cmd, config.raspberry.controlTimeoutMs);
      res.status(202).json({ ok: true, forwarded: true, target: url, result });
    } catch (err) {
      const message = err?.message || String(err);
      res.status(502).json({ ok: false, error: message });
    }
  });

  return router;
}
