// crypto-e2ee.js

// ---------- UTILS ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

// ---------- ECDH ----------
export async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );
}

export async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(raw);
}

export async function importPublicKey(b64) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBuf(b64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

// ---------- KEY DERIVATION ----------
export async function deriveAESKey(privateKey, publicKey, layers) {
  const layerSalt = enc.encode([...layers].sort().join("-"));

  return crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- AES ----------
export async function encryptAES(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return {
    iv: bufToBase64(iv),
    data: bufToBase64(cipher)
  };
}

export async function decryptAES(key, payload) {
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBuf(payload.iv)
    },
    key,
    base64ToBuf(payload.data)
  );

  return dec.decode(plain);
}
