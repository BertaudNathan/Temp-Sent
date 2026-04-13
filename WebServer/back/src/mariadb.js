import mysql from "mysql2/promise";
import { config } from "./config.js";

export async function createMariaPool() {
  const pool = mysql.createPool({
    host: config.mariadb.host,
    port: config.mariadb.port,
    user: config.mariadb.user,
    password: config.mariadb.password,
    database: config.mariadb.database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60_000,
    enableKeepAlive: true,
  });

  // Sanity check
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }

  return pool;
}
