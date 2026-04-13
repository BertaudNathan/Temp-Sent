import process from "node:process";
import fs from "node:fs";
import mqtt from "mqtt";
import admin from "firebase-admin";

const MQTT_URL = process.env.MQTT_URL || "mqtt://mosquitto:1883";
const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || `mqtt-firebase-bridge-${Math.random().toString(16).slice(2, 8)}`;

const TELEMETRY_TOPICS = (process.env.MQTT_TELEMETRY_TOPICS || "iot/sensors/+/telemetry")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const KPI_TOPICS = (process.env.MQTT_KPI_TOPICS || "iot/sensors/+/info,iot/sensors/+/errors,iot/actuators/+/status")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "";
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "/run/secrets/firebase-service-account.json";
const FIREBASE_TELEMETRY_PATH = process.env.FIREBASE_TELEMETRY_PATH || "/iot/telemetry";
const FIREBASE_HARDWARE_PATH = process.env.FIREBASE_HARDWARE_PATH || "/iot/hardware";

function normalizeDbPath(path) {
  if (!path) {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function initFirebaseDatabase() {
  if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH introuvable: ${FIREBASE_SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccountRaw = fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(serviceAccountRaw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: FIREBASE_DATABASE_URL,
  });

  return admin.database();
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

function withServerTimestamp(payload) {
  return {
    ...payload,
    timestamp_server: admin.database.ServerValue.TIMESTAMP,
  };
}

async function pushToRealtimeDb(db, path, payload) {
  await db.ref(normalizeDbPath(path)).push(withServerTimestamp(payload));
}

async function sendTelemetryData(db, topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    temperature: Number(message.temperature),
    humidity: Number(message.humidity),
    timestamp_device: message.timestamp ?? null,
    raw: message,
  };

  await pushToRealtimeDb(db, FIREBASE_TELEMETRY_PATH, data);
}

async function sendHardwareKPI(db, topic, message) {
  const data = {
    topic,
    device_id: extractDeviceId(topic, message.device_id),
    kpi_type: topic.split("/").slice(-1)[0] || "unknown",
    timestamp_device: message.timestamp ?? null,
    raw: message,
  };

  await pushToRealtimeDb(db, FIREBASE_HARDWARE_PATH, data);
}

function main() {
  const db = initFirebaseDatabase();

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
        await sendTelemetryData(db, topic, parsed.data);
        console.log(`[Firebase RTDB] Telemetry envoyee: ${topic}`);
        return;
      }

      await sendHardwareKPI(db, topic, parsed.data);
      console.log(`[Firebase RTDB] Hardware envoye: ${topic}`);
    } catch (err) {
      console.error(`[Firebase RTDB] Erreur envoi (${topic}):`, err.message);
    }
  });
}

main();



