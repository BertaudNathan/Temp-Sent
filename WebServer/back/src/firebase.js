import fs from "node:fs";
import admin from "firebase-admin";
import { config } from "./config.js";

function normalizeDbPath(path) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function initFirebase() {
  if (!config.firebase.databaseUrl) {
    throw new Error("FIREBASE_DATABASE_URL manquant");
  }

  if (!fs.existsSync(config.firebase.serviceAccountPath)) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH introuvable: ${config.firebase.serviceAccountPath}`);
  }

  if (admin.apps.length === 0) {
    const serviceAccountRaw = fs.readFileSync(config.firebase.serviceAccountPath, "utf8");
    const serviceAccount = JSON.parse(serviceAccountRaw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.firebase.databaseUrl,
    });
  }

  return {
    admin,
    db: admin.database(),
    normalizeDbPath,
  };
}
