import crypto from 'crypto';
import { db } from './db';
import { parsePermissions, ALL_TAB_KEYS } from './permissions';
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
  const info = await getUserRoleInfo(username);
  return createStatelessSession(username, {
    permissions: info ? info.permissions : undefined,
    is_super: info ? info.is_super : false,
    role_id: info ? info.role_id : undefined,
  });
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

export async function createUser(username, password, roleId = null) {
  const passwordHash = await hashPassword(password);
  const result = await db.query(
    'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, username, created_at, role_id',
    [username, passwordHash, roleId]
  );
  return result.rows[0];
}

export async function getUsers() {
  const result = await db.query(
    `SELECT u.id, u.username, u.created_at, u.role_id, r.name AS role_name
     FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.id`
  );
  return result.rows;
}

export async function updateUser(id, username, password, roleId) {
  if (password) {
    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `UPDATE users SET username = $1, password_hash = $2,
       role_id = COALESCE($3, role_id) WHERE id = $4 RETURNING id, username, role_id`,
      [username, passwordHash, roleId ?? null, id]
    );
    return result.rows[0];
  }
  const result = await db.query(
    `UPDATE users SET username = $1, role_id = COALESCE($2, role_id) WHERE id = $3 RETURNING id, username, role_id`,
    [username, roleId ?? null, id]
  );
  return result.rows[0];
}

export async function deleteUser(id) {
  await db.query('DELETE FROM users WHERE id = $1', [id]);
}

// Resolve a username to its role + parsed permission set.
export async function getUserRoleInfo(username) {
  const result = await db.query(
    `SELECT u.id, u.username, r.id AS role_id, r.name AS role_name, r.permissions, r.is_super
     FROM users u LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.username = $1`,
    [username]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role_id: row.role_id,
    role_name: row.role_name,
    permissions: row.is_super === true ? ALL_TAB_KEYS : parsePermissions(row.permissions),
    is_super: row.is_super === true,
  };
}

// Verify the request's session cookie and resolve the caller's role/permissions.
export async function getCurrentUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : undefined;
  const session = await verifyStatelessToken(token);
  if (!session) return null;
  return getUserRoleInfo(session.username);
}

// ---- Roles ----

export async function getRoles() {
  const result = await db.query(
    `SELECT r.id, r.name, r.permissions, r.is_super, r.created_at,
            COUNT(u.id)::int AS user_count
     FROM roles r LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id ORDER BY r.id`
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    permissions: row.is_super === true ? ALL_TAB_KEYS : parsePermissions(row.permissions),
    is_super: row.is_super === true,
    created_at: row.created_at,
    user_count: row.user_count,
  }));
}

export async function getRoleById(id) {
  const result = await db.query('SELECT * FROM roles WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, permissions: parsePermissions(row.permissions), is_super: row.is_super === true };
}

export async function createRole(name, permissions) {
  const result = await db.query(
    'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING *',
    [name, JSON.stringify(permissions)]
  );
  return result.rows[0];
}

export async function updateRole(id, name, permissions) {
  const result = await db.query(
    'UPDATE roles SET name = $1, permissions = $2 WHERE id = $3 AND is_super = false RETURNING *',
    [name, JSON.stringify(permissions), id]
  );
  return result.rows[0] || null;
}

export async function deleteRole(id) {
  const role = await getRoleById(id);
  if (!role || role.is_super) return { error: 'Forbidden role' };
  const inUse = await db.query('SELECT COUNT(*)::int AS n FROM users WHERE role_id = $1', [id]);
  if (inUse.rows[0].n > 0) {
    return { error: `Role is assigned to ${inUse.rows[0].n} user(s)` };
  }
  await db.query('DELETE FROM roles WHERE id = $1', [id]);
  return { ok: true };
}
