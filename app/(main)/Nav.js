'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/home', label: 'Home', key: 'home' },
  { href: '/inventory', label: 'Inventory', key: 'inventory' },
  { href: '/invoice', label: 'Create Invoice', key: 'invoice' },
  { href: '/history', label: 'Invoice History', key: 'history' },
  { href: '/reports', label: 'Reports', key: 'reports' },
  { href: '/settings', label: 'Settings', key: 'settings' },
];

export default function Nav({ initialAuthed = false, initialPermissions = [], initialIsSuper = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState(initialAuthed);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [isSuper, setIsSuper] = useState(initialIsSuper);
  const [menuOpen, setMenuOpen] = useState(false);

  // Refresh permissions from the DB on every page (fresh role data).
  // Anonymous visitors skip this entirely — they only ever see Home.
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!alive) return;
        if (!me) { setPermissions([]); setAuthed(false); return; }
        setPermissions(me.permissions || []);
        setIsSuper(me.is_super === true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname, authed]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthed(false);
    setPermissions([]);
    router.push('/home');
    router.refresh();
  }

  // Home is public — visible to everyone. The remaining tabs are
  // filtered by the user's role permissions (null while loading).
  const visibleTabs = permissions === null || isSuper
    ? TABS
    : TABS.filter((t) => t.key === 'home' || permissions.includes(t.key));

  return (
    <nav className="nav">
      <Link href="/home" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/logo.png" alt="RupRong" style={{ height: 44, width: 'auto', display: 'block' }} />
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>RupRong</span>
      </Link>
      <div className={`nav-tabs${menuOpen ? ' open' : ''}`}>
        {visibleTabs.map((t) => (
          <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? 'active' : ''} onClick={() => setMenuOpen(false)}>
            {t.label}
          </Link>
        ))}
        {authed ? (
          <span className="logout" onClick={() => { setMenuOpen(false); logout(); }}>Log Out</span>
        ) : (
          <Link href="/login" className="logout" onClick={() => setMenuOpen(false)}>Log In</Link>
        )}
      </div>
      <button type="button" className="nav-toggle" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
        {menuOpen ? '✕' : '☰'}
      </button>
    </nav>
  );
}
