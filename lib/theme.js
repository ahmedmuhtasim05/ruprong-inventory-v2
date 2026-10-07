import { db } from './db';

export async function getThemeColor() {
  const result = await db.query("SELECT value FROM settings WHERE key = 'theme_color'");
  return result.rows[0]?.value || '#b8860b';
}

export async function setThemeColor(color) {
  await db.query(
    `INSERT INTO settings (key, value) VALUES ('theme_color', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
    [color]
  );
}

export function generateThemeColors(primaryColor) {
  // Generate light and dark variants from primary color
  const hex = primaryColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const lighten = (amount) => {
    const newR = Math.min(255, r + Math.round((255 - r) * amount));
    const newG = Math.min(255, g + Math.round((255 - g) * amount));
    const newB = Math.min(255, b + Math.round((255 - b) * amount));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  const darken = (amount) => {
    const newR = Math.max(0, Math.round(r * (1 - amount)));
    const newG = Math.max(0, Math.round(g * (1 - amount)));
    const newB = Math.max(0, Math.round(b * (1 - amount)));
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  };

  return {
    primary: primaryColor,
    primaryLight: lighten(0.3),
    primaryDark: darken(0.3),
  };
}
