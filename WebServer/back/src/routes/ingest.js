import express from "express";

function extractDeviceIdFromTopic(topic) {
  if (!topic) return null;
  const parts = String(topic).split("/");
  return parts.length >= 3 ? parts[2] : null;
}

function withServerTimestamp(admin, payload) {
  return {
    ...payload,
    timestamp_server: admin.database.ServerValue.TIMESTAMP,
  };
}

async function pushToRtdb(db, normalizeDbPath, path, payload) {
  await db.ref(normalizeDbPath(path)).push(payload);
}

export function createIngestRouter({ admin, db, normalizeDbPath, telemetryPath, hardwarePath }) {
  const router = express.Router();

  router.post("/telemetry", async (req, res) => {
    try {
      const body = req.body ?? {};
      const topic = body.topic ?? null;

      const temperature = body.temperature != null ? Number(body.temperature) : null;
      const humidity = body.humidity != null ? Number(body.humidity) : null;

      const data = {
        topic,
        device_id: body.device_id ?? extractDeviceIdFromTopic(topic) ?? "unknown",
        temperature: Number.isFinite(temperature) ? temperature : null,
        humidity: Number.isFinite(humidity) ? humidity : null,
        timestamp_device: body.timestamp_device ?? body.timestamp ?? null,
        raw: body.raw ?? body,
      };

      await pushToRtdb(db, normalizeDbPath, telemetryPath, withServerTimestamp(admin, data));
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  router.post("/hardware", async (req, res) => {
    try {
      const body = req.body ?? {};
      const topic = body.topic ?? null;

      const data = {
        topic,
        device_id: body.device_id ?? extractDeviceIdFromTopic(topic) ?? "unknown",
        kpi_type: body.kpi_type ?? (topic ? String(topic).split("/").slice(-1)[0] : "unknown"),
        timestamp_device: body.timestamp_device ?? body.timestamp ?? null,
        raw: body.raw ?? body,
      };

      await pushToRtdb(db, normalizeDbPath, hardwarePath, withServerTimestamp(admin, data));
      res.status(201).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  return router;
}
