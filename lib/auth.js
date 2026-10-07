import crypto from 'crypto';
import { db } from './db';
import {
  createSession as createStatelessSession,
  verifySessionToken as verifyStatelessToken,
  destroySession as destroyStatelessSession,
  SESSION_COOKIE_NAME,
} from './sessions';

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const testHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

// Sessions are stateless signed tokens (see ./sessions) so they stay valid
// across Vercel's Edge middleware and Node.js API routes, which do not share
// an in-memory session store.
export async function createSession(username) {
  return createStatelessSession(username);
}

export async function verifySessionToken(token) {
  return verifyStatelessToken(token);
}

export async function destroySession(token) {
  return destroyStatelessSession(token);
}

export { SESSION_COOKIE_NAME };

export async function getUserByUsername(username) {
  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

export async function createUser(username, password) {
  const passwordHash = await hashPassword(password);
  const result = await db.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
    [username, passwordHash]
  );
  return result.rows[0];
}

export async function getUsers() {
  const result = await db.query('SELECT id, username, created_at FROM users ORDER BY id');
  return result.rows;
}

export async function updateUser(id, username, password) {
  if (password) {
    const passwordHash = await hashPassword(password);
    const result = await db.query(
      'UPDATE users SET username = $1, password_hash = $2 WHERE id = $3 RETURNING id, username',
      [username, passwordHash, id]
    );
    return result.rows[0];
  }
  const result = await db.query(
    'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username',
    [username, id]
  );
  return result.rows[0];
}

export async function deleteUser(id) {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}
