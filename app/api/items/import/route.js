import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const body = await request.json();
    const { csv, excel } = body;

    let rows = [];

    if (excel) {
      // Parse Excel
      const buffer = Buffer.from(excel, 'base64');
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Remove header row
      rows = rows.slice(1);
    } else if (csv) {
      // Parse CSV
      const parsed = Papa.parse(csv, { skipEmptyLines: true });
      rows = parsed.data.slice(1); // Skip header
    }

    let inserted = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const [sku, name, category, quantity, price, cost_price, notes] = row;
      if (!name) {
        errors.push({ row: i + 2, message: 'Missing name' });
        continue;
      }

      try {
        // Check if item exists by SKU
        const existing = await db.query('SELECT id FROM items WHERE sku = $1', [sku || '']);

        if (existing.rows.length > 0) {
          // Update existing
          await db.query(
            'UPDATE items SET name=$1, category=$2, quantity=$3, price=$4, cost_price=$5, notes=$6 WHERE sku=$7',
            [name, category || '', parseInt(quantity) || 0, parseFloat(price) || 0, parseFloat(cost_price) || null, notes || '', sku]
          );
          updated++;
        } else {
          // Insert new
          let finalSku = sku;
          if (!finalSku) {
            const maxResult = await db.query(
              "SELECT MAX(CAST(SUBSTRING(sku FROM 3) AS INTEGER)) as max_num FROM items WHERE sku LIKE 'BN%'"
            );
            const nextNum = (maxResult.rows[0]?.max_num || 0) + 1;
            finalSku = `BN${nextNum}`;
          }
          await db.query(
            'INSERT INTO items (sku, name, category, quantity, price, cost_price, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [finalSku, name, category || '', parseInt(quantity) || 0, parseFloat(price) || 0, parseFloat(cost_price) || null, notes || '']
          );
          inserted++;
        }
      } catch (err) {
        errors.push({ row: i + 2, message: err.message });
      }
    }

    // Get next SKU
    const maxResult = await db.query(
      "SELECT MAX(CAST(SUBSTRING(sku FROM 3) AS INTEGER)) as max_num FROM items WHERE sku LIKE 'BN%'"
    );
    const nextSku = (maxResult.rows[0]?.max_num || 0) + 1;

    return NextResponse.json({ inserted, updated, errors, nextSku });
  } catch (error) {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
