import express from "express";

function parseTimeMs(input) {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  const text = String(input);
  const asNum = Number(text);
  if (Number.isFinite(asNum) && text.trim() !== "") return asNum;

  const asDate = Date.parse(text);
  return Number.isFinite(asDate) ? asDate : null;
}

function normalizeSource(input) {
  const value = String(input || "both").toLowerCase();
  if (value === "hot" || value === "cold" || value === "both") return value;
  return "both";
}

function limitFromQuery(input) {
  const n = Number(input ?? "200");
  if (!Number.isFinite(n)) return 200;
  return Math.max(1, Math.min(1000, Math.floor(n)));
}

async function readHotRtdb(ref, { sinceMs, untilMs, limit }) {
  let query = ref.orderByChild("timestamp_server");
  if (sinceMs != null) query = query.startAt(sinceMs);
  if (untilMs != null) query = query.endAt(untilMs);
  query = query.limitToLast(limit);

  const snap = await query.get();
  const val = snap.val();
  if (!val) return [];

  return Object.entries(val).map(([key, value]) => ({
    id: key,
    ...value,
    source: "hot",
  }));
}

async function readColdMaria(pool, table, { sinceMs, untilMs, limit }) {
  const where = [];
  const params = [];

  if (sinceMs != null) {
    where.push("timestamp_server >= ?");
    params.push(sinceMs);
  }
  if (untilMs != null) {
    where.push("timestamp_server <= ?");
    params.push(untilMs);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT rtdb_key, timestamp_server, timestamp_device, device_id, topic, payload_json, archived_at ${table === "telemetry_archive" ? ", temperature, humidity" : ", kpi_type"}
     FROM ${table}
     ${whereSql}
     ORDER BY timestamp_server DESC
     LIMIT ?`,
    [...params, limit],
  );

  return rows.map((r) => {
    let payload = null;
    try {
      payload = JSON.parse(r.payload_json);
    } catch {
      payload = { raw: r.payload_json };
    }

    return {
      id: r.rtdb_key,
      ...payload,
      timestamp_server: r.timestamp_server,
      timestamp_device: r.timestamp_device,
      device_id: r.device_id,
      topic: r.topic,
      ...(r.temperature != null ? { temperature: Number(r.temperature) } : {}),
      ...(r.humidity != null ? { humidity: Number(r.humidity) } : {}),
      ...(r.kpi_type != null ? { kpi_type: r.kpi_type } : {}),
      archived_at: r.archived_at,
      source: "cold",
    };
  });
}

function mergeDedupSort(items) {
  const map = new Map();
  for (const item of items) {
    const id = item?.id;
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, item);
      continue;
    }
    // Prefer cold version if duplicate
    const current = map.get(id);
    if (current?.source !== "cold" && item?.source === "cold") {
      map.set(id, item);
    }
  }

  return [...map.values()].sort((a, b) => Number(b.timestamp_server ?? 0) - Number(a.timestamp_server ?? 0));
}

export function createDataRouter({ db, normalizeDbPath, pool, telemetryPath, hardwarePath }) {
  const router = express.Router();

  router.get("/telemetry", async (req, res) => {
    try {
      const source = normalizeSource(req.query.source);
      const sinceMs = parseTimeMs(req.query.since);
      const untilMs = parseTimeMs(req.query.until);
      const limit = limitFromQuery(req.query.limit);

      const tasks = [];
      if (source === "hot" || source === "both") {
        tasks.push(readHotRtdb(db.ref(normalizeDbPath(telemetryPath)), { sinceMs, untilMs, limit }));
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (source === "cold" || source === "both") {
        tasks.push(readColdMaria(pool, "telemetry_archive", { sinceMs, untilMs, limit }));
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [hot, cold] = await Promise.all(tasks);
      const merged = mergeDedupSort([...(hot || []), ...(cold || [])]).slice(0, limit);
      res.json({ ok: true, source, count: merged.length, data: merged });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  router.get("/hardware", async (req, res) => {
    try {
      const source = normalizeSource(req.query.source);
      const sinceMs = parseTimeMs(req.query.since);
      const untilMs = parseTimeMs(req.query.until);
      const limit = limitFromQuery(req.query.limit);

      const tasks = [];
      if (source === "hot" || source === "both") {
        tasks.push(readHotRtdb(db.ref(normalizeDbPath(hardwarePath)), { sinceMs, untilMs, limit }));
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (source === "cold" || source === "both") {
        tasks.push(readColdMaria(pool, "hardware_archive", { sinceMs, untilMs, limit }));
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [hot, cold] = await Promise.all(tasks);
      const merged = mergeDedupSort([...(hot || []), ...(cold || [])]).slice(0, limit);
      res.json({ ok: true, source, count: merged.length, data: merged });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  return router;
}
