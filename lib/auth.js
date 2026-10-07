import crypto from 'crypto';
import { db } from './db';

const SESSION_COOKIE_NAME = 'rr_session';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const globalForAuth = globalThis;

async function getSessions() {
  if (!globalForAuth._sessions) {
    globalForAuth._sessions = new Map();
  }
  return globalForAuth._sessions;
}

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

export async function createSession(username) {
  const sessions = await getSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_EXPIRY_MS;
  sessions.set(token, { username, expires });
  return { token, expires };
}

export async function verifySessionToken(token) {
  if (!token) return null;
  const sessions = await getSessions();
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export async function destroySession(token) {
  const sessions = await getSessions();
  sessions.delete(token);
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
