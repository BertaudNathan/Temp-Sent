import process from "node:process";
import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL || "mqtt://mosquitto:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || `mqtt-rest-bridge-${Math.random().toString(16).slice(2, 8)}`;

const TELEMETRY_TOPICS = (process.env.MQTT_TELEMETRY_TOPICS || "iot/sensors/+/telemetry")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const KPI_TOPICS = (process.env.MQTT_KPI_TOPICS || "iot/sensors/+/info,iot/sensors/+/errors,iot/actuators/+/status")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const REST_BASE_URL = process.env.REST_BASE_URL || "https://your-backend.vercel.app";
const REST_TELEMETRY_PATH = process.env.REST_TELEMETRY_PATH || "/api/iot/telemetry";
const REST_KPI_PATH = process.env.REST_KPI_PATH || "/api/iot/kpi";
const REST_AUTH_TOKEN = process.env.REST_AUTH_TOKEN || "";

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

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };

  if (REST_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${REST_AUTH_TOKEN}`;
  }

  return headers;
}

function withServerTimestamp(payload) {
  return {
    ...payload,
    timestamp_server: new Date().toISOString(),
  };
}

async function postToBackend(path, payload) {
  const url = new URL(path, REST_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(withServerTimestamp(payload)),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText} - ${responseBody}`);
  }
}

// Envoie les données de télémétrie vers le backend REST (temperature/humidity)
async function sendTelemetryData(topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    temperature: Number(message.temperature),
    humidity: Number(message.humidity),
    timestamp_device: message.timestamp ?? null,
    raw: message,
  };

  await postToBackend(REST_TELEMETRY_PATH, data);
}

// Envoie les donnees KPI vers le backend REST (info/errors/status)
async function sendHardwareKPI(topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    kpi_type: topic.split("/").slice(-1)[0] || "unknown",
    timestamp_device: message.timestamp ?? null,
    raw: message,
  };

  await postToBackend(REST_KPI_PATH, data);
}

function main() {
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
        await sendTelemetryData(topic, parsed.data);
        console.log(`[REST] Telemetry envoyee: ${topic}`);
        return;
      }

      await sendHardwareKPI(topic, parsed.data);
      console.log(`[REST] KPI envoye: ${topic}`);
    } catch (err) {
      console.error(`[REST] Erreur envoi (${topic}):`, err.message);
    }
  });
}

main();



