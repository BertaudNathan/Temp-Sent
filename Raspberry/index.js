import process from "node:process";
import mqtt from "mqtt";

const REST_BASE_URL_RAW = (process.env.REST_BASE_URL || "").trim();
const REST_TELEMETRY_PATH = (process.env.REST_TELEMETRY_PATH || "/api/v1/telemetry").trim();
// Backward compat with older naming used in README
const REST_KPI_PATH = (process.env.REST_KPI_PATH || process.env.REST_HARDWARE_PATH || "/api/v1/hardware").trim();

const HTTP_TIMEOUT_MS = Math.max(1000, Number(process.env.HTTP_TIMEOUT_MS || "5000"));

const MQTT_URL = (process.env.MQTT_URL || "mqtt://mosquitto:1883").trim();
const MQTT_USERNAME = (process.env.MQTT_USERNAME || "").trim();
const MQTT_PASSWORD = (process.env.MQTT_PASSWORD || "").trim();
const MQTT_CLIENT_ID = (process.env.MQTT_CLIENT_ID || `mqtt-firebase-bridge-${Math.random().toString(16).slice(2, 8)}`).trim();

const TELEMETRY_TOPICS = (process.env.MQTT_TELEMETRY_TOPICS || "iot/sensors/+/telemetry")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const KPI_TOPICS = (process.env.MQTT_KPI_TOPICS || "iot/sensors/+/info,iot/sensors/+/errors,iot/actuators/+/status")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

function normalizeBaseUrl(baseUrlRaw) {
  const raw = String(baseUrlRaw || "").trim();
  if (!raw) {
    throw new Error("REST_BASE_URL manquant (ex: http://192.168.1.20:8080)");
  }

  const withScheme = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `http://${raw}`;
  // Remove trailing slashes to avoid double // when joining.
  return withScheme.replace(/\/+$/, "");
}

function buildUrl(baseUrl, path) {
  const p = String(path || "").trim() || "/";
  const normalizedPath = p.startsWith("/") ? p : `/${p}`;
  return `${baseUrl}${normalizedPath}`;
}

async function postJson(url, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }

    return true;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Timeout HTTP apres ${HTTP_TIMEOUT_MS}ms vers ${url}`);
    }

    const cause = err?.cause;
    const causeCode = cause?.code ? String(cause.code) : "";
    const causeMessage = cause?.message ? String(cause.message) : "";
    const details = [causeCode, causeMessage].filter(Boolean).join(" ").trim();

    if (err?.message === "fetch failed") {
      throw new Error(`Fetch failed vers ${url}${details ? ` - ${details}` : ""}`);
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonPayload(payloadBuffer) {
  const payloadText = payloadBuffer.toString("utf8");
  try {
    return {
      ok: true,
      data: JSON.parse(payloadText),
      raw: payloadText,
    };
  } catch {
    return {
      ok: false,
      data: null,
      raw: payloadText,
    };
  }
}

function extractDeviceId(topic, fallback) {
  const parts = topic.split("/");
  if (parts.length >= 3) {
    return parts[2];
  }
  return fallback || "unknown";
}
// Veirife si le topic envoyé correspond a un pattern sur lequel on est sensé ecouter
function topicMatchesPattern(topic, pattern) {
  const topicParts = topic.split("/");
  const patternParts = pattern.split("/");

  let t = 0;
  let p = 0;

  while (t < topicParts.length && p < patternParts.length) {
    const patternPart = patternParts[p];

    if (patternPart === "#") {
      return true;
    }

    if (patternPart !== "+" && patternPart !== topicParts[t]) {
      return false;
    }

    t += 1;
    p += 1;
  }

  if (t === topicParts.length && p === patternParts.length) {
    return true;
  }

  return p === patternParts.length - 1 && patternParts[p] === "#";
}

function isTelemetryTopic(topic) {
  return TELEMETRY_TOPICS.some((pattern) => topicMatchesPattern(topic, pattern));
}

async function sendTelemetryData(baseUrl, topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    temperature: message.temperature,
    humidity: message.humidity,
    timestamp: message.timestamp ?? null,
    raw: message,
  };

  await postJson(buildUrl(baseUrl, REST_TELEMETRY_PATH), data);
}

async function sendHardwareKPI(baseUrl, topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    kpi_type: topic.split("/").slice(-1)[0] || "unknown",
    timestamp: message.timestamp ?? null,
    raw: message,
  };

  await postJson(buildUrl(baseUrl, REST_KPI_PATH), data);
}

function main() {
  const baseUrl = normalizeBaseUrl(REST_BASE_URL_RAW);
  console.log(`[HTTP] Destination API: ${baseUrl}`);
  console.log(`[HTTP] Telemetry path: ${REST_TELEMETRY_PATH}`);
  console.log(`[HTTP] KPI path: ${REST_KPI_PATH}`);

  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    clientId: MQTT_CLIENT_ID,
    keepalive: 60,
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    const topics = [...TELEMETRY_TOPICS, ...KPI_TOPICS];
    console.log(`[MQTT] Connecte a ${MQTT_URL}`);
    client.subscribe(topics, (err) => {
      if (err) {
        console.error("[MQTT] Echec abonnement", err.message);
        return;
      }
      console.log(`[MQTT] Abonne aux topics: ${topics.join(", ")}`);
    });
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnexion...");
  });

  client.on("error", (err) => {
    console.error("[MQTT] Erreur", err.message);
  });

  client.on("message", async (topic, payloadBuffer) => {
    const parsed = parseJsonPayload(payloadBuffer);
    if (!parsed.ok) {
      console.warn(`[MQTT] Payload non JSON ignore sur ${topic}: ${parsed.raw}`);
      return;
    }

    try {
      if (isTelemetryTopic(topic)) {
        await sendTelemetryData(baseUrl, topic, parsed.data);
        console.log(`[HTTP] Telemetry envoyee: ${topic}`);
        return;
      }

      await sendHardwareKPI(baseUrl, topic, parsed.data);
      console.log(`[HTTP] Hardware envoye: ${topic}`);
    } catch (err) {
      console.error(`[HTTP] Erreur envoi (${topic}):`, err?.message || err);
    }
  });
}

main();



