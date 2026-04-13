import process from "node:process";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || "8080"),

  firebase: {
    databaseUrl: process.env.FIREBASE_DATABASE_URL || "",
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "/run/secrets/firebase-service-account.json",
    telemetryPath: process.env.FIREBASE_TELEMETRY_PATH || "/iot/telemetry",
    hardwarePath: process.env.FIREBASE_HARDWARE_PATH || "/iot/hardware",
  },

  mariadb: {
    host: process.env.MARIADB_HOST || "127.0.0.1",
    port: Number(process.env.MARIADB_PORT || "3306"),
    database: process.env.MARIADB_DATABASE || "tempsent",
    user: process.env.MARIADB_USER || "tempsent",
    password: process.env.MARIADB_PASSWORD || "tempsent",
  },

  archive: {
    enabled: (process.env.ARCHIVE_CRON_ENABLED || "true").toLowerCase() === "true",
    schedule: process.env.ARCHIVE_CRON_SCHEDULE || "5 0 * * *",
    olderThanHours: Number(process.env.ARCHIVE_OLDER_THAN_HOURS || "24"),
    pageSize: Math.max(1, Math.min(1000, Number(process.env.ARCHIVE_PAGE_SIZE || "500"))),
    deleteChunkSize: Math.max(1, Math.min(1000, Number(process.env.ARCHIVE_DELETE_CHUNK_SIZE || "500"))),
  },
};
