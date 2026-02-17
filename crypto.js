const enc = new TextEncoder();
const dec = new TextDecoder();

/* Gizli koddan anahtar üret */
export async function deriveKey(secret) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("volktronic-salt"),
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* Şifrele */
export async function encryptMessage(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return {
    cipher: btoa(String.fromCharCode(...new Uint8Array(cipher))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

/* Çöz */
export async function decryptMessage(key, cipher, iv) {
  const data = Uint8Array.from(atob(cipher), c => c.charCodeAt(0));
  const ivArr = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivArr },
    key,
    data
  );

  return dec.decode(plain);
}
