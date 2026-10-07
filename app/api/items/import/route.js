import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { getNextSerialSku } from '../../../../lib/sku';
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
        // Insert new — generate a serial SKU (BN1, BN2, ...) when blank
        const autoSku = !sku || !String(sku).trim();
        let finalSku = autoSku ? null : String(sku).trim();
        let attempts = 0;
        let done = false;

        while (attempts <= 5 && !done) {
          if (!finalSku) finalSku = await getNextSerialSku(db);
          try {
            await db.query(
              'INSERT INTO items (sku, name, category, quantity, price, cost_price, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [finalSku, name, category || '', parseInt(quantity) || 0, parseFloat(price) || 0, parseFloat(cost_price) || null, notes || '']
            );
            inserted++;
            done = true;
          } catch (err) {
            if (err.code === '23505') {
              if (autoSku && attempts < 5) {
                attempts++;
                finalSku = null;
                continue;
              }
              errors.push({ row: i + 2, message: `SKU ${finalSku} already exists` });
            } else {
              errors.push({ row: i + 2, message: err.message });
            }
            done = true;
          }
        }
      }
    }

    // Next available serial SKU
    const nextSku = await getNextSerialSku(db);

    return NextResponse.json({ inserted, updated, errors, nextSku });
  } catch (error) {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
