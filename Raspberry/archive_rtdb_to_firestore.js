import process from "node:process";
import fs from "node:fs";
import admin from "firebase-admin";

const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "";
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "/run/secrets/firebase-service-account.json";

const FIREBASE_TELEMETRY_PATH = process.env.FIREBASE_TELEMETRY_PATH || "/iot/telemetry";
const FIREBASE_HARDWARE_PATH = process.env.FIREBASE_HARDWARE_PATH || "/iot/hardware";

const FIRESTORE_TELEMETRY_COLLECTION = process.env.FIRESTORE_TELEMETRY_COLLECTION || "iot_telemetry_archive";
const FIRESTORE_HARDWARE_COLLECTION = process.env.FIRESTORE_HARDWARE_COLLECTION || "iot_hardware_archive";

const ARCHIVE_OLDER_THAN_HOURS = Number(process.env.ARCHIVE_OLDER_THAN_HOURS || "24");
const PAGE_SIZE = Math.max(1, Math.min(1000, Number(process.env.ARCHIVE_PAGE_SIZE || "500")));
const DELETE_CHUNK_SIZE = Math.max(1, Math.min(1000, Number(process.env.ARCHIVE_DELETE_CHUNK_SIZE || "500")));

function normalizeDbPath(path) {
  if (!path) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function initFirebase() {
  if (!FIREBASE_DATABASE_URL) {
    throw new Error("FIREBASE_DATABASE_URL manquant (ex: https://<project>-default-rtdb.europe-west1.firebasedatabase.app)");
  }

  if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH introuvable: ${FIREBASE_SERVICE_ACCOUNT_PATH}`);
  }

  const serviceAccountRaw = fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(serviceAccountRaw);

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: FIREBASE_DATABASE_URL,
    });
  }

  return {
    db: admin.database(),
    firestore: admin.firestore(),
  };
}

function nowMs() {
  return Date.now();
}

function getCutoffMs() {
  const hours = Number.isFinite(ARCHIVE_OLDER_THAN_HOURS) ? ARCHIVE_OLDER_THAN_HOURS : 24;
  return nowMs() - hours * 60 * 60 * 1000;
}
// tri des entrées d'abord par timestamp_server croissant, puis par clé croissante pour garantir un ordre stable et éviter les doublons lors de la pagination avec startAt() et endAt()
function sortByTimestampThenKey(entries) {
  return entries.sort((a, b) => {
    const tsA = Number(a[1]?.timestamp_server ?? 0);
    const tsB = Number(b[1]?.timestamp_server ?? 0);
    if (tsA !== tsB) return tsA - tsB;
    return a[0].localeCompare(b[0]);
  });
}

// supprime les data liées au clées données
async function deleteKeysInChunks(ref, keys) {
  for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
    const chunk = keys.slice(i, i + DELETE_CHUNK_SIZE);
    const updates = {};
    for (const key of chunk) {
      updates[key] = null;
    }
    // Multi-location update with null deletes children.
    await ref.update(updates);
  }
}

//corp principal de l'archivage
async function archiveRtdbPathToFirestore({ db, firestore, rtdbPath, firestoreCollection, cutoffMs }) {
  const ref = db.ref(normalizeDbPath(rtdbPath));
  const collection = firestore.collection(firestoreCollection);

  let lastTimestamp = null;
  let lastKey = null;
  let totalArchived = 0;

  while (true) {
    let query = ref.orderByChild("timestamp_server").endAt(cutoffMs).limitToFirst(PAGE_SIZE);
    if (lastTimestamp != null && lastKey != null) {
      query = query.startAt(lastTimestamp, lastKey);
    }

    const snap = await query.get();
    const page = snap.val();
    if (!page) {
      break;
    }

    let entries = sortByTimestampThenKey(Object.entries(page));

    // startAt() includes the last item again; remove it to avoid duplicates.
    if (lastTimestamp != null && lastKey != null) {
      entries = entries.filter(([key]) => key !== lastKey);
    }

    if (entries.length === 0) {
      break;
    }

    const writer = firestore.bulkWriter();

    for (const [key, value] of entries) {
      const docRef = collection.doc(key);
      writer.set(docRef, {
        ...value,
        _meta: {
          source: "rtdb",
          rtdb_path: normalizeDbPath(rtdbPath),
          rtdb_key: key,
          archived_at: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, { merge: false });
    }

    await writer.close();

    await deleteKeysInChunks(ref, entries.map(([key]) => key));

    totalArchived += entries.length;

    const [finalKey, finalValue] = entries[entries.length - 1];
    lastKey = finalKey;
    lastTimestamp = Number(finalValue?.timestamp_server ?? cutoffMs);

    if (entries.length < PAGE_SIZE) {
      break;
    }
  }

  return totalArchived;
}


// initialise puis lance l'archivage
async function main() {
  const { db, firestore } = initFirebase();
  const cutoffMs = getCutoffMs();

  console.log(`[Archive] Cutoff: ${new Date(cutoffMs).toISOString()} (<= cutoff sera archive puis supprime)`);

  const archivedTelemetry = await archiveRtdbPathToFirestore({
    db,
    firestore,
    rtdbPath: FIREBASE_TELEMETRY_PATH,
    firestoreCollection: FIRESTORE_TELEMETRY_COLLECTION,
    cutoffMs,
  });

  const archivedHardware = await archiveRtdbPathToFirestore({
    db,
    firestore,
    rtdbPath: FIREBASE_HARDWARE_PATH,
    firestoreCollection: FIRESTORE_HARDWARE_COLLECTION,
    cutoffMs,
  });

  console.log(`[Archive] Telemetry archivee: ${archivedTelemetry}`);
  console.log(`[Archive] Hardware archive: ${archivedHardware}`);
  console.log("[Archive] OK");
}

main().catch((err) => {
  console.error("[Archive] Erreur:", err?.message || err);
  process.exitCode = 1;
});
