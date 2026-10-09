'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/inventory', label: 'Inventory', key: 'inventory' },
  { href: '/invoice', label: 'Create Invoice', key: 'invoice' },
  { href: '/history', label: 'Invoice History', key: 'history' },
  { href: '/reports', label: 'Reports', key: 'reports' },
  { href: '/settings', label: 'Settings', key: 'settings' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [permissions, setPermissions] = useState(null); // null = still loading
  const [isSuper, setIsSuper] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!alive || !me) return;
        setPermissions(me.permissions || []);
        setIsSuper(me.is_super === true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  // While permissions load, show all tabs to avoid a flash of empty nav.
  const visibleTabs = permissions === null || isSuper
    ? TABS
    : TABS.filter((t) => permissions.includes(t.key));

  return (
    <nav className="nav">
      <span className="nav-brand">RupRong</span>
      <div className={`nav-tabs${menuOpen ? ' open' : ''}`}>
        {visibleTabs.map((t) => (
          <Link key={t.href} href={t.href} className={pathname.startsWith(t.href) ? 'active' : ''} onClick={() => setMenuOpen(false)}>
            {t.label}
          </Link>
        ))}
        <span className="logout" onClick={() => { setMenuOpen(false); logout(); }}>Log Out</span>
      </div>
      <button type="button" className="nav-toggle" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
        {menuOpen ? '✕' : '☰'}
      </button>
    </nav>
  );
}
