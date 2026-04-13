import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedEnvDir = path.resolve(here, ".."); // WebServer/
const hasSharedEnv =
  fs.existsSync(path.join(sharedEnvDir, ".env")) ||
  fs.existsSync(path.join(sharedEnvDir, ".env.local"));

export default defineConfig({
  envDir: hasSharedEnv ? sharedEnvDir : here,
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
