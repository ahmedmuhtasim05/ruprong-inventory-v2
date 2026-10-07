import { Pool } from 'pg';

const globalForPg = globalThis;

const pool = globalForPg._pgPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

if (process.env.NODE_ENV !== 'production') globalForPg._pgPool = pool;

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT DEFAULT '',
        quantity INTEGER DEFAULT 0,
        price NUMERIC(12,2) DEFAULT 0,
        cost_price NUMERIC(12,2),
        notes TEXT DEFAULT '',
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_no TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT DEFAULT '',
        customer_address TEXT DEFAULT '',
        parcel_id TEXT DEFAULT '',
        discount_type TEXT DEFAULT 'none',
        discount_value NUMERIC(12,2) DEFAULT 0,
        delivery_charge NUMERIC(12,2) DEFAULT 0,
        total NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(12,2) NOT NULL,
        line_total NUMERIC(12,2) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
      CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no);
      CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    `);

    // Insert default theme if not exists
    await client.query(`
      INSERT INTO settings (key, value) VALUES ('theme_color', '#b8860b')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}
