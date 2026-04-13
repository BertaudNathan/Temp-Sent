import { config } from "./config.js";

function nowMs() {
  return Date.now();
}

function getCutoffMs() {
  const hours = Number.isFinite(config.archive.olderThanHours) ? config.archive.olderThanHours : 24;
  return nowMs() - hours * 60 * 60 * 1000;
}

function toBigIntOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sortByTimestampThenKey(entries) {
  return entries.sort((a, b) => {
    const tsA = Number(a[1]?.timestamp_server ?? 0);
    const tsB = Number(b[1]?.timestamp_server ?? 0);
    if (tsA !== tsB) return tsA - tsB;
    return a[0].localeCompare(b[0]);
  });
}

async function deleteKeysInChunks(ref, keys, deleteChunkSize) {
  for (let i = 0; i < keys.length; i += deleteChunkSize) {
    const chunk = keys.slice(i, i + deleteChunkSize);
    const updates = {};
    for (const key of chunk) {
      updates[key] = null;
    }
    await ref.update(updates);
  }
}

async function insertTelemetryRows(pool, rows) {
  if (rows.length === 0) return;

  const values = rows.map((r) => [
    r.rtdb_key,
    r.timestamp_server,
    r.timestamp_device,
    r.device_id,
    r.topic,
    r.temperature,
    r.humidity,
    r.payload_json,
  ]);

  await pool.query(
    "INSERT IGNORE INTO telemetry_archive (rtdb_key, timestamp_server, timestamp_device, device_id, topic, temperature, humidity, payload_json) VALUES ?",
    [values],
  );
}

async function insertHardwareRows(pool, rows) {
  if (rows.length === 0) return;

  const values = rows.map((r) => [
    r.rtdb_key,
    r.timestamp_server,
    r.timestamp_device,
    r.device_id,
    r.topic,
    r.kpi_type,
    r.payload_json,
  ]);

  await pool.query(
    "INSERT IGNORE INTO hardware_archive (rtdb_key, timestamp_server, timestamp_device, device_id, topic, kpi_type, payload_json) VALUES ?",
    [values],
  );
}

async function archiveRtdbPath({ db, normalizeDbPath, pool, rtdbPath, kind, cutoffMs }) {
  const ref = db.ref(normalizeDbPath(rtdbPath));

  let lastTimestamp = null;
  let lastKey = null;
  let totalArchived = 0;

  while (true) {
    let query = ref.orderByChild("timestamp_server").endAt(cutoffMs).limitToFirst(config.archive.pageSize);
    if (lastTimestamp != null && lastKey != null) {
      query = query.startAt(lastTimestamp, lastKey);
    }

    const snap = await query.get();
    const page = snap.val();
    if (!page) break;

    let entries = sortByTimestampThenKey(Object.entries(page));
    if (lastTimestamp != null && lastKey != null) {
      entries = entries.filter(([key]) => key !== lastKey);
    }

    if (entries.length === 0) break;

    if (kind === "telemetry") {
      const rows = entries.map(([key, value]) => ({
        rtdb_key: key,
        timestamp_server: toBigIntOrNull(value?.timestamp_server),
        timestamp_device: toBigIntOrNull(value?.timestamp_device ?? value?.timestamp ?? null),
        device_id: value?.device_id ?? null,
        topic: value?.topic ?? null,
        temperature: Number.isFinite(Number(value?.temperature)) ? Number(value.temperature) : null,
        humidity: Number.isFinite(Number(value?.humidity)) ? Number(value.humidity) : null,
        payload_json: JSON.stringify(value ?? {}),
      }));

      await insertTelemetryRows(pool, rows);
    } else {
      const rows = entries.map(([key, value]) => ({
        rtdb_key: key,
        timestamp_server: toBigIntOrNull(value?.timestamp_server),
        timestamp_device: toBigIntOrNull(value?.timestamp_device ?? value?.timestamp ?? null),
        device_id: value?.device_id ?? null,
        topic: value?.topic ?? null,
        kpi_type: value?.kpi_type ?? (value?.topic ? String(value.topic).split("/").slice(-1)[0] : null),
        payload_json: JSON.stringify(value ?? {}),
      }));

      await insertHardwareRows(pool, rows);
    }

    await deleteKeysInChunks(ref, entries.map(([key]) => key), config.archive.deleteChunkSize);

    totalArchived += entries.length;

    const [finalKey, finalValue] = entries[entries.length - 1];
    lastKey = finalKey;
    lastTimestamp = Number(finalValue?.timestamp_server ?? cutoffMs);

    if (entries.length < config.archive.pageSize) break;
  }

  return totalArchived;
}

export async function runArchiveOnce({ db, normalizeDbPath, pool, telemetryPath, hardwarePath }) {
  const cutoffMs = getCutoffMs();
  console.log(`[Archive] Cutoff: ${new Date(cutoffMs).toISOString()}`);

  const archivedTelemetry = await archiveRtdbPath({
    db,
    normalizeDbPath,
    pool,
    rtdbPath: telemetryPath,
    kind: "telemetry",
    cutoffMs,
  });

  const archivedHardware = await archiveRtdbPath({
    db,
    normalizeDbPath,
    pool,
    rtdbPath: hardwarePath,
    kind: "hardware",
    cutoffMs,
  });

  console.log(`[Archive] Archived telemetry: ${archivedTelemetry}`);
  console.log(`[Archive] Archived hardware: ${archivedHardware}`);

  return { archivedTelemetry, archivedHardware, cutoffMs };
}
