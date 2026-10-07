'use client';
import { useEffect, useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';

export default function SettingsPage() {
  const [confirmText, setConfirmText] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // User management
  const [users, setUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [userError, setUserError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');

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

  useEffect(() => { loadUsers(); loadTheme(); }, [loadUsers, loadTheme]);

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
    const res = await fetch('/api/settings/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUsername, password: newPassword }) });
    const data = await res.json();
    if (!res.ok) { setUserError(data.error || 'Failed.'); return; }
    setUserMsg(`User "${data.user.username}" created.`); setNewUsername(''); setNewPassword(''); loadUsers();
  }

  function startEdit(user) { setEditingUser(user.id); setEditUsername(user.username); setEditPassword(''); }

  async function handleUpdateUser(e) {
    e.preventDefault(); setUserError(''); setUserMsg('');
    const payload = { username: editUsername }; if (editPassword) payload.password = editPassword;
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

  async function saveTheme() {
    setThemeError(''); setThemeMsg('');
    try {
      const res = await fetch('/api/settings/theme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ color: themeColor }) });
      const data = await res.json();
      if (!res.ok) { setThemeError(data.error || 'Failed.'); return; }
      // Apply theme immediately
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
        <table style={{ marginTop: 12 }}><thead><tr><th>ID</th><th>Username</th><th>Created</th><th></th></tr></thead>
          <tbody>{users.map((u) => <tr key={u.id}><td>{u.id}</td><td>{editingUser === u.id ? <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} style={{ width: 120, padding: '4px 8px' }} /> : u.username}</td><td>{u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : '—'}</td><td>{editingUser === u.id ? <><input type="password" placeholder="New password (blank = keep)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} style={{ width: 160, padding: '4px 8px', marginRight: 6 }} /><button className="btn btn-sm btn-primary" onClick={handleUpdateUser}>Save</button> <button className="btn btn-sm" onClick={() => setEditingUser(null)}>Cancel</button></> : <><button className="btn btn-sm" onClick={() => startEdit(u)}>Edit</button> <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u)}>Delete</button></>}</td></tr>)}</tbody>
        </table>
        <form onSubmit={handleCreateUser} style={{ marginTop: 16 }}><h3 style={{ fontSize: 14, color: 'var(--primary)' }}>Create New User</h3><div className="row"><div className="field"><label>Username</label><input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required /></div><div className="field"><label>Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div><button type="submit" className="btn btn-primary">Create User</button></div></form>
      </div>

      {/* About */}
      <div className="card"><h2>About</h2><p>RupRong Inventory & Invoicing — web version 2.0</p><p className="muted">Your data is stored in a private Neon Postgres database.</p></div>

      {/* Danger Zone */}
      <div className="card" style={{ borderColor: 'var(--danger)' }}><h2 style={{ color: 'var(--danger)' }}>Danger Zone</h2>{error && <div className="msg msg-error">{error}</div>}{msg && <div className="msg msg-success">{msg}</div>}<p>Permanently erase every inventory item and invoice. This cannot be undone.</p><div className="field"><label>Type DELETE to confirm</label><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} /></div><button className="btn btn-danger" style={{ marginTop: 10 }} onClick={clearAll} disabled={busy}>{busy ? 'Clearing...' : 'Clear All Data'}</button></div>
    </div>
  );
}
