// ── Kryptering av sensitiv kundedata ─────────────────────────────────────
// Bruker Web Crypto API (AES-GCM) med nøkkel derivert fra bruker-ID.

const SALT = new TextEncoder().encode('KalkyleApp-v1-salt');
const SENSITIVE_FIELDS = ['name', 'phone', 'email', 'address'];

async function deriveKey(userId) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(userId), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptString(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(text)
  );
  const buf = new Uint8Array(iv.length + encrypted.byteLength);
  buf.set(iv);
  buf.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...buf));
}

async function decryptString(b64, key) {
  try {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv = buf.slice(0, 12);
    const data = buf.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return b64; // Returnerer rå verdi hvis dekryptering feiler (ukryptert data)
  }
}

export async function encryptCustomers(customers, userId) {
  if (!customers?.length || !userId) return customers;
  const key = await deriveKey(userId);
  return Promise.all(customers.map(async c => {
    const copy = { ...c, _encrypted: true };
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field]) copy[field] = await encryptString(copy[field], key);
    }
    return copy;
  }));
}

export async function decryptCustomers(customers, userId) {
  if (!customers?.length || !userId) return customers;
  const key = await deriveKey(userId);
  return Promise.all(customers.map(async c => {
    if (!c._encrypted) return c;
    const copy = { ...c };
    delete copy._encrypted;
    for (const field of SENSITIVE_FIELDS) {
      if (copy[field]) copy[field] = await decryptString(copy[field], key);
    }
    return copy;
  }));
}
