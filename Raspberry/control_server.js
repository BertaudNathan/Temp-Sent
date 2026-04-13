import process from "node:process";
import express from "express";
import mqtt from "mqtt";

const PORT = Number(process.env.CONTROL_PORT || "4000");

const MQTT_URL = (process.env.MQTT_URL || "mqtt://mosquitto:1883").trim();
const MQTT_USERNAME = (process.env.MQTT_USERNAME || "").trim();
const MQTT_PASSWORD = (process.env.MQTT_PASSWORD || "").trim();
const MQTT_CLIENT_ID = (process.env.MQTT_CLIENT_ID || `raspberry-control-${Math.random().toString(16).slice(2, 8)}`).trim();

const ACTUATOR_ON_SPEED_PCT = Math.max(0, Math.min(100, Number(process.env.ACTUATOR_ON_SPEED_PCT || "100")));

function actuatorTopic(actuatorId) {
  return `iot/actuators/${actuatorId}/command`;
}

function normalizeCommand(body) {
  const command = String(body?.command || "").trim().toLowerCase();
  if (!command) {
    throw new Error("command requis");
  }

  if (command === "on") {
    return { action: "set_motor", value: ACTUATOR_ON_SPEED_PCT };
  }

  if (command === "off") {
    return { action: "set_motor", value: 0 };
  }

  if (command === "reset") {
    return { action: "reset" };
  }

  if (command === "emergency_stop") {
    return { action: "emergency_stop" };
  }

  if (command === "set_motor") {
    const value = Number(body?.value);
    if (!Number.isFinite(value)) {
      throw new Error("value requis pour set_motor");
    }
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return { action: "set_motor", value: clamped };
  }

  throw new Error(`command inconnue: ${command}`);
}

async function main() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME || undefined,
    password: MQTT_PASSWORD || undefined,
    clientId: MQTT_CLIENT_ID,
    keepalive: 60,
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    console.log(`[Raspberry-Control] MQTT connecte a ${MQTT_URL}`);
  });

  client.on("reconnect", () => {
    console.log("[Raspberry-Control] MQTT reconnexion...");
  });

  client.on("error", (err) => {
    console.error("[Raspberry-Control] MQTT erreur:", err?.message || err);
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, mqtt: client.connected });
  });

  app.post("/api/v1/actuators/:id/command", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      if (!id) {
        res.status(400).json({ ok: false, error: "actuator id requis" });
        return;
      }

      const payloadObj = normalizeCommand(req.body);
      const topic = actuatorTopic(id);
      const payload = JSON.stringify(payloadObj);

      const ok = await new Promise((resolve, reject) => {
        client.publish(topic, payload, { qos: 0, retain: false }, (err) => {
          if (err) reject(err);
          else resolve(true);
        });
      });

      res.status(202).json({ ok: true, published: ok, topic, payload: payloadObj });
    } catch (err) {
      res.status(400).json({ ok: false, error: err?.message || String(err) });
    }
  });

  app.listen(PORT, () => {
    console.log(`[Raspberry-Control] Listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error("[Raspberry-Control] Fatal:", err?.message || err);
  process.exitCode = 1;
});
