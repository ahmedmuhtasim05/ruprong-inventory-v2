// Tab-level permission model shared by the Nav, middleware and APIs.

export const TABS = [
  { key: 'inventory', label: 'Inventory', href: '/inventory' },
  { key: 'invoice', label: 'Create Invoice', href: '/invoice' },
  { key: 'history', label: 'Invoice History', href: '/history' },
  { key: 'reports', label: 'Reports', href: '/reports' },
  { key: 'settings', label: 'Settings', href: '/settings' },
];

export const ALL_TAB_KEYS = TABS.map((t) => t.key);

export function parsePermissions(text) {
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// Page path -> tab key, used by middleware to gate page access.
export function tabKeyForPath(pathname) {
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/invoice')) return 'invoice';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}
