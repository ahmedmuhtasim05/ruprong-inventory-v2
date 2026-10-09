import './globals.css';

export const metadata = {
  title: 'RupRong Inventory & Invoicing',
  description: 'Inventory and invoicing for RupRong by Ananna',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
