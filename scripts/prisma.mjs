/**
 * Responsibility:
 * - Run Prisma CLI with consistent env loading and Windows-safe engine settings.
 *
 * Notes:
 * - Next.js uses `.env.local` by convention. Prisma CLI does NOT automatically load env files
 *   when a Prisma config file exists, so we keep env loading centralized in `prisma.config.ts`.
 *
 * Guards:
 * - If `DATABASE_URL` is missing, default to the repo-standard SQLite file.
 * - If a non-standard SQLite path is used (e.g. `file:./dev.db`), warn in development.
 */
import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const DEFAULT_SQLITE_DATABASE_URL = "file:./prisma/dev.db";
const NON_STANDARD_SQLITE_DATABASE_URL = "file:./dev.db";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    [
      "Usage: node scripts/prisma.mjs <prisma-args...>",
      "",
      "Examples:",
      "  node scripts/prisma.mjs migrate dev",
      "  node scripts/prisma.mjs generate",
    ].join("\n"),
  );
  process.exit(1);
}

const env = { ...process.env };

if (!env.DATABASE_URL) {
  env.DATABASE_URL = DEFAULT_SQLITE_DATABASE_URL;
}

if (env.NODE_ENV !== "production" && env.DATABASE_URL === NON_STANDARD_SQLITE_DATABASE_URL) {
  console.warn(
    [
      "[prisma] Detected DATABASE_URL=file:./dev.db (non-standard for this repo).",
      "[prisma] Recommended: DATABASE_URL=\"file:./prisma/dev.db\"",
      "[prisma] See docs: docs/prisma-operations.md",
    ].join("\n"),
  );
}

const currentPlatform = platform();

// Ensure spawn cwd is repo root even if called from elsewhere.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

/**
 * Guard:
 * - On Windows, spawning `npx.cmd` can fail depending on the calling shell (e.g. Git Bash).
 *   `shell: true` makes command resolution consistent across shells.
 */
const child = spawn("npx", ["prisma", ...args], {
  cwd: repoRoot,
  env,
  stdio: "inherit",
  shell: currentPlatform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
