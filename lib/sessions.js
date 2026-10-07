// Stateless session tokens, safe for both the Edge Runtime (middleware) and
// Node.js API routes, which run in separate processes that do not share memory.
//
// Token format: base64url(JSON payload) "." base64url(HMAC-SHA256 signature)
// The payload carries the username and expiry; the signature makes it
// tamper-proof. No server-side session store is needed.

const SESSION_COOKIE_NAME = 'rr_session';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret() {
  return process.env.SESSION_SECRET || '';
}

function encodeBase64Url(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(str) {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSigningKey() {
  const secret = getSessionSecret();
  if (!secret) return null;
  const encoded = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    'raw',
    encoded,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSession(username, context = {}) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required to create sessions');
  }
  const expires = Date.now() + SESSION_EXPIRY_MS;
  const payload = encodeBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        username,
        expires,
        permissions: context.permissions,
        is_super: context.is_super,
        role_id: context.role_id,
      })
    )
  );
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const token = `${payload}.${encodeBase64Url(signature)}`;
  return { token, expires };
}

export async function verifySessionToken(token) {
  if (!token) return null;
  const separatorIndex = token.indexOf('.');
  if (separatorIndex < 0) return null;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (!data.username || typeof data.expires !== 'number') return null;
    if (data.expires < Date.now()) return null;
    const key = await getSigningKey();
    if (!key) return null;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(payload)
    );
    if (!valid) return null;
    return {
      username: data.username,
      permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
      is_super: data.is_super === true,
      role_id: typeof data.role_id === 'number' ? data.role_id : undefined,
    };
  } catch {
    return null;
  }
}

export async function destroySession(token) {
  // Stateless tokens cannot be revoked server-side; the caller clears the
  // client cookie, which ends the session in the browser.
  return true;
}

export { SESSION_COOKIE_NAME };
