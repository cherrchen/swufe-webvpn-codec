import aesjs from "aes-js";

const BLOCK = 16;

/**
 * AES-128-CFB with a 128-bit segment, matching Python `cryptography` CFB.
 * aes-js's own CFB defaults to a 1-bit segment, so this file uses aes-js only
 * as the block encryptor and owns the feedback.
 */
export function aesCfb128Encrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
  return aesCfb128(key, iv, plaintext, false);
}

export function aesCfb128Decrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  return aesCfb128(key, iv, ciphertext, true);
}

function aesCfb128(key: Uint8Array, iv: Uint8Array, input: Uint8Array, decrypt: boolean): Uint8Array {
  if (key.length !== BLOCK || iv.length !== BLOCK) {
    throw new Error("AES-128-CFB128 requires 16-byte key and iv");
  }
  const out = new Uint8Array(input.length);
  let prev = iv;
  let offset = 0;
  const ecb = new aesjs.ModeOfOperation.ecb(key);
  while (offset < input.length) {
    const keystream = ecb.encrypt(prev);
    const n = Math.min(BLOCK, input.length - offset);
    const next = new Uint8Array(BLOCK);
    for (let i = 0; i < n; i += 1) {
      const byte = input[offset + i] ?? 0;
      const stream = keystream[i] ?? 0;
      out[offset + i] = byte ^ stream;
      next[i] = decrypt ? byte : (out[offset + i] ?? 0);
    }
    if (n === BLOCK) {
      prev = next;
    }
    offset += n;
  }
  return out;
}
