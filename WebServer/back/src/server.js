import process from "node:process";
import express from "express";
import cron from "node-cron";

import { config } from "./config.js";
import { initFirebase } from "./firebase.js";
import { createMariaPool } from "./mariadb.js";
import { runArchiveOnce } from "./archiveJob.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createDataRouter } from "./routes/data.js";

async function main() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const { admin, db, normalizeDbPath } = initFirebase();
  const pool = await createMariaPool();

  app.get("/health", async (_req, res) => {
    try {
      const conn = await pool.getConnection();
      try {
        await conn.ping();
      } finally {
        conn.release();
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  });

  app.use(
    "/api/v1",
    createIngestRouter({
      admin,
      db,
      normalizeDbPath,
      telemetryPath: config.firebase.telemetryPath,
      hardwarePath: config.firebase.hardwarePath,
    }),
  );

  app.use(
    "/api/v1",
    createDataRouter({
      db,
      normalizeDbPath,
      pool,
      telemetryPath: config.firebase.telemetryPath,
      hardwarePath: config.firebase.hardwarePath,
    }),
  );

  if (config.archive.enabled) {
    console.log(`[Cron] Archive enabled: ${config.archive.schedule} (TZ=${process.env.TZ || "system"})`);
    cron.schedule(
      config.archive.schedule,
      async () => {
        try {
          await runArchiveOnce({
            db,
            normalizeDbPath,
            pool,
            telemetryPath: config.firebase.telemetryPath,
            hardwarePath: config.firebase.hardwarePath,
          });
        } catch (err) {
          console.error("[Cron] Archive error:", err?.message || err);
        }
      },
      { timezone: process.env.TZ || undefined },
    );
  } else {
    console.log("[Cron] Archive disabled");
  }

  app.listen(config.port, () => {
    console.log(`[API] Listening on :${config.port}`);
  });

  process.on("SIGINT", async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error("[API] Fatal:", err?.message || err);
  process.exitCode = 1;
});
