/**
 * Responsibility:
 * - Generate a random master key for `APP_CONFIG_ENCRYPTION_KEY`.
 *
 * Notes:
 * - This key is used to encrypt/decrypt secrets stored in the database (AES-256-GCM).
 * - Keep it in `.env.local` and never commit it.
 */
import crypto from "node:crypto";

const ENCRYPTION_KEY_BYTES = 32;

const keyBase64 = crypto.randomBytes(ENCRYPTION_KEY_BYTES).toString("base64");

console.log("APP_CONFIG_ENCRYPTION_KEY=" + keyBase64);
