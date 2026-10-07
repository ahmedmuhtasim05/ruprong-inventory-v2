'use client';
import { useEffect, useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';

const PERMISSION_TABS = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'invoice', label: 'Create Invoice' },
  { key: 'history', label: 'Invoice History' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider"></span>
    </label>
  );
}

export default function SettingsPage() {
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Current user / permissions
  const [me, setMe] = useState(null);

  // User management
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [userError, setUserError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoleId, setEditRoleId] = useState('');

  // Roles & permissions
  const [roles, setRoles] = useState([]);
  const [roleMsg, setRoleMsg] = useState('');
  const [roleError, setRoleError] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState(['inventory']);

  // Theme
  const [themeColor, setThemeColor] = useState('#b8860b');
  const [themeMsg, setThemeMsg] = useState('');
  const [themeError, setThemeError] = useState('');

  const loadUsers = useCallback(async () => {
    try { const res = await fetch('/api/settings/users'); const data = await res.json(); setUsers(data.users || []); } catch {}
  }, []);

  const loadTheme = useCallback(async () => {
    try { const res = await fetch('/api/settings/theme'); const data = await res.json(); setThemeColor(data.color || '#b8860b'); } catch {}
  }, []);

  const loadRoles = useCallback(async () => {
    try { const res = await fetch('/api/settings/roles'); const data = await res.json(); setRoles(data.roles || []); } catch {}
  }, []);

  const loadMe = useCallback(async () => {
    try { const res = await fetch('/api/auth/me'); const data = await res.json(); if (res.ok) setMe(data); } catch {}
  }, []);

  useEffect(() => { loadUsers(); loadTheme(); loadRoles(); loadMe(); }, [loadUsers, loadTheme, loadRoles, loadMe]);

  async function clearAll() {
    if (confirmText !== 'DELETE') { setError('Type "DELETE" to confirm.'); return; }
    if (!confirm('This will permanently erase ALL data. Continue?')) return;
    setBusy(true); setError(''); setMsg('');
    try {
      const res = await fetch('/api/settings/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: confirmText }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed.'); return; }
      setMsg('All data erased.'); setConfirmText('');
    } finally { setBusy(false); }
  }

  async function handleCreateUser(e) {
    e.preventDefault(); setUserError(''); setUserMsg('');
    const payload = { username: newUsername, password: newPassword };
    if (newRoleId) payload.role_id = parseInt(newRoleId);
    const res = await fetch('/api/settings/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Failed.'); return; }
    setUserMsg(`User "${data.user.username}" created.`); setNewUsername(''); setNewPassword(''); setNewRoleId(''); loadUsers();
  }

  function startEdit(user) {
    setEditingUser(user.id);
    setEditUsername(user.username);
    setEditPassword('');
    setEditRoleId(user.role_id ? String(user.role_id) : '');
  }

  async function handleUpdateUser(e) {
    e.preventDefault(); setUserError(''); setUserMsg('');
    const payload = { username: editUsername };
    if (editPassword) payload.password = editPassword;
    if (editRoleId) payload.role_id = parseInt(editRoleId);
    const res = await fetch(`/api/settings/users/${editingUser}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Failed.'); return; }
    setUserMsg('User updated.'); setEditingUser(null); loadUsers();
  }

  async function handleDeleteUser(user) {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    setUserError(''); setUserMsg('');
    const res = await fetch(`/api/settings/users/${user.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Failed.'); return; }
    setUserMsg(`User "${user.username}" deleted.`); loadUsers();
  }

  async function toggleRolePermission(role, tabKey, on) {
    setRoleError(''); setRoleMsg('');
    const next = on ? [...role.permissions, tabKey] : role.permissions.filter((p) => p !== tabKey);
    const res = await fetch(`/api/settings/roles/${role.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: next }),
    });
    const data = await res.json();
    if (!res.ok) { setRoleError(data.error || 'Failed to update role.'); return; }
    setRoleMsg(`Role "${data.role.name}" updated.`);
    setTimeout(() => setRoleMsg(''), 3000);
    loadRoles();
  }

  function toggleNewRolePerm(key) {
    setNewRolePerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleCreateRole(e) {
    e.preventDefault(); setRoleError(''); setRoleMsg('');
    const res = await fetch('/api/settings/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, permissions: newRolePerms }),
    });
    const data = await res.json();
    if (!res.ok) { setRoleError(data.error || 'Failed to create role.'); return; }
    setRoleMsg(`Role "${data.role.name}" created.`);
    setNewRoleName(''); setNewRolePerms(['inventory']);
    loadRoles();
  }

  async function handleDeleteRole(role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setRoleError(''); setRoleMsg('');
    const res = await fetch(`/api/settings/roles/${role.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setRoleError(data.error || 'Failed to delete role.'); return; }
    setRoleMsg(`Role "${role.name}" deleted.`);
    loadRoles();
  }

  async function saveTheme() {
    setThemeError(''); setThemeMsg('');
    try {
      const res = await fetch('/api/settings/theme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: themeColor }) });
      const data = await res.json();
      if (!res.ok) { setThemeError(data.error || 'Failed.'); return; }
      document.documentElement.style.setProperty('--primary', themeColor);
      document.documentElement.style.setProperty('--gold', themeColor);
      setThemeMsg('Theme saved and applied!');
      setTimeout(() => setThemeMsg(''), 3000);
    } catch { setThemeError('Failed to save theme.'); }
  }

  return (
    <div>
      <h2 style={{ color: 'var(--primary)' }}>Settings</h2>

      {/* Theme Customization */}
      <div className="card">
        <h2>Theme Color</h2>
        <p className="muted">Choose your custom theme color. Changes apply immediately across the entire app.</p>
        {themeError && <div className="msg msg-error">{themeError}</div>}
        {themeMsg && <div className="msg msg-success">{themeMsg}</div>}
        <div className="color-picker-wrapper">
          <HexColorPicker color={themeColor} onChange={setThemeColor} style={{ width: 200, height: 200 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Selected Color</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: themeColor }}>{themeColor}</p>
            <div className="theme-preview" style={{ background: themeColor, color: 'white' }}>
              <p style={{ fontWeight: 600 }}>Preview</p>
              <p style={{ fontSize: 13, opacity: 0.9 }}>This is how your theme will look</p>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={saveTheme}>Save Theme</button>
        </div>
      </div>

      {/* User Management */}
      <div className="card">
        <h2>User Management</h2>
        {userError && <div className="msg msg-error">{userError}</div>}
        {userMsg && <div className="msg msg-success">{userMsg}</div>}
        <table style={{ marginTop: 12 }}><thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Created</th><th></th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td>{u.id}</td><td>{editingUser === u.id ? <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: 120, padding: '4px 8px' }} /> : u.username}</td><td>{editingUser === u.id ? <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} disabled={!me?.is_super}><option value="">No role</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : (u.role_name || '—')}</td><td>{u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '—'}</td><td>{editingUser === u.id ? <><input type="password" placeholder="New password (blank = keep)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ width: 160, padding: '4px 8px', marginRight: 6 }} /><button className="btn btn-sm btn-primary" onClick={handleUpdateUser}>Save</button> <button className="btn btn-sm" onClick={() => setEditingUser(null)}>Cancel</button></> : <><button className="btn btn-sm" onClick={() => startEdit(u)}>Edit</button> <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)}>Delete</button></>}</td></tr>)}</tbody>
        </table>
        <form onSubmit={handleCreateUser} style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 14, color: 'var(--primary)' }}>Create New User</h3>
          <div className="row">
            <div className="field"><label>Username</label><input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required /></div>
            <div className="field"><label>Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
            <div className="field"><label>Role</label><select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)}><option value="">No role</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
            <button type="submit" className="btn btn-primary">Create User</button>
          </div>
        </form>
      </div>

      {/* Roles & Permissions — superadmin only */}
      {me?.is_super && (
        <div className="card">
          <h2>Roles &amp; Permissions</h2>
          <p className="muted">Create roles and toggle which tabs each role can see. The Superadmin role always has full access and cannot be changed.</p>
          {roleError && <div className="msg msg-error">{roleError}</div>}
          {roleMsg && <div className="msg msg-success">{roleMsg}</div>}
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Role</th>
                {PERMISSION_TABS.map((t) => <th key={t.key}>{t.label}</th>)}
                <th>Users</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}{role.is_super ? ' ⭐' : ''}</td>
                  {PERMISSION_TABS.map((t) => (
                    <td key={t.key}>
                      <Toggle
                        checked={role.permissions.includes(t.key)}
                        disabled={role.is_super}
                        onChange={(on) => toggleRolePermission(role, t.key, on)}
                      />
                    </td>
                  ))}
                  <td>{role.user_count}</td>
                  <td>{!role.is_super && <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRole(role)}>Delete</button>}</td>
                </tr>
              ))}
              {roles.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 12 }}>No roles yet.</td></tr>}
            </tbody>
          </table>
          <form onSubmit={handleCreateRole} style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, color: 'var(--primary)' }}>Create New Role</h3>
            <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
              <div className="field"><label>Role name</label><input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Sales Staff" required /></div>
              {PERMISSION_TABS.map((t) => (
                <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, paddingBottom: 8 }}>
                  <input type="checkbox" checked={newRolePerms.includes(t.key)} onChange={() => toggleNewRolePerm(t.key)} />
                  {t.label}
                </label>
              ))}
              <button type="submit" className="btn btn-primary">Create Role</button>
            </div>
          </form>
        </div>
      )}

      {/* About */}
      <div className="card"><h2>About</h2><p>RupRong Inventory & Invoicing — web version 2.0</p><p className="muted">Your data is stored in a private Neon Postgres database.</p></div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'var(--danger)' }}><h2 style={{ color: 'var(--danger)' }}>Danger Zone</h2>{error && <div className="msg msg-error">{error}</div>}{msg && <div className="msg msg-success">{msg}</div>}<p>Permanently erase every inventory item and invoice. This cannot be undone.</p><div className="field"><label>Type DELETE to confirm</label><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} /></div><button className="btn btn-danger" style={{ marginTop: 10 }} onClick={clearAll} disabled={busy}>{busy ? 'Clearing...' : 'Clear All Data'}</button></div>
    </div>
  );
}
