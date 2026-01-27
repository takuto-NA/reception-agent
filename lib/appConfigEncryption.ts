import crypto from "node:crypto";

/**
 * Responsibility:
 * - Encrypt and decrypt sensitive app configuration values stored in the database.
 *
 * Notes:
 * - We use AES-256-GCM (authenticated encryption).
 * - The master key is NOT stored in DB; provide it via `APP_CONFIG_ENCRYPTION_KEY`.
 *
 * Guards:
 * - Refuse to operate without a valid master key.
 * - Refuse to decrypt unknown payload versions.
 */

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_BYTES = 32;
const ENCRYPTION_IV_BYTES = 12;
const PAYLOAD_VERSION = "v1";
const PAYLOAD_SEPARATOR = ":";
const ENCRYPTION_AAD = "reception-agent/app-config";

function parseEncryptionKeyFromEnvironment(): Buffer {
  const rawKey = process.env.APP_CONFIG_ENCRYPTION_KEY;
  // Guard: missing master key.
  if (!rawKey) {
    throw new Error("APP_CONFIG_ENCRYPTION_KEY is required to use encrypted settings");
  }

  const trimmedKey = rawKey.trim();
  // Guard: empty key.
  if (!trimmedKey) {
    throw new Error("APP_CONFIG_ENCRYPTION_KEY is required to use encrypted settings");
  }

  const hexKeyPattern = /^[0-9a-fA-F]+$/;
  const isLikelyHexKey = hexKeyPattern.test(trimmedKey);

  const keyBytes = isLikelyHexKey
    ? Buffer.from(trimmedKey, "hex")
    : Buffer.from(trimmedKey, "base64");

  // Guard: key must be 32 bytes for AES-256-GCM.
  if (keyBytes.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error(
      `APP_CONFIG_ENCRYPTION_KEY must be ${ENCRYPTION_KEY_BYTES} bytes (base64 or hex)`,
    );
  }

  return keyBytes;
}

function toBase64(value: Buffer): string {
  return value.toString("base64");
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, "base64");
}

export function encryptAppConfigSecret(plaintext: string): string {
  // Guard: refuse empty plaintext.
  if (!plaintext.trim()) {
    throw new Error("Secret value must be non-empty");
  }

  const keyBytes = parseEncryptionKeyFromEnvironment();
  const initializationVector = crypto.randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBytes, initializationVector);
  cipher.setAAD(Buffer.from(ENCRYPTION_AAD, "utf8"));

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    toBase64(initializationVector),
    toBase64(authenticationTag),
    toBase64(ciphertext),
  ].join(PAYLOAD_SEPARATOR);
}

export function decryptAppConfigSecret(payload: string): string {
  const trimmedPayload = payload.trim();
  // Guard: refuse empty payload.
  if (!trimmedPayload) {
    throw new Error("Encrypted payload must be non-empty");
  }

  const [version, initializationVectorBase64, authenticationTagBase64, ciphertextBase64] =
    trimmedPayload.split(PAYLOAD_SEPARATOR);

  // Guard: unknown payload format/version.
  if (version !== PAYLOAD_VERSION) {
    throw new Error(`Unsupported encrypted payload version: ${version ?? "(missing)"}`);
  }

  // Guard: missing parts.
  if (!initializationVectorBase64 || !authenticationTagBase64 || !ciphertextBase64) {
    throw new Error("Encrypted payload is invalid");
  }

  const keyBytes = parseEncryptionKeyFromEnvironment();
  const initializationVector = fromBase64(initializationVectorBase64);
  const authenticationTag = fromBase64(authenticationTagBase64);
  const ciphertext = fromBase64(ciphertextBase64);

  // Guard: IV size mismatch.
  if (initializationVector.length !== ENCRYPTION_IV_BYTES) {
    throw new Error("Encrypted payload is invalid");
  }

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBytes, initializationVector);
  decipher.setAAD(Buffer.from(ENCRYPTION_AAD, "utf8"));
  decipher.setAuthTag(authenticationTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

