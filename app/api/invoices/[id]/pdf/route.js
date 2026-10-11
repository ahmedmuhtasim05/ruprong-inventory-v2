import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { PDFDocument, rgb } from 'pdf-lib';
import { embedFonts, drawMixedText } from '../../../../../lib/pdf-font';

export async function GET(request, { params }) {
  const { id } = params;

  const invResult = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (invResult.rows.length === 0) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const itemsResult = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
  const invoice = invResult.rows[0];
  const items = itemsResult.rows;

  // Create PDF — Bangla-capable font for Bangla text, Helvetica for Latin
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);

  let page = pdfDoc.addPage([595, 842]); // A4
  let y = 800;
  const gold = rgb(0.72, 0.53, 0.04);
  const grey = rgb(0.8, 0.8, 0.8);

  // Start a new page with a repeated header (for long invoices)
  function newPage(continued) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
    drawMixedText(page, 'RupRong Inventory', { x: 50, y, size: 16, fonts, bold: true, color: gold });
    y -= 28;
    drawMixedText(page, `Invoice: ${invoice.invoice_no}${continued ? ' (continued)' : ''}`, { x: 50, y, size: 12, fonts, bold: true });
    y -= 20;
    drawMixedText(page, `Date: ${invoice.invoice_date}`, { x: 50, y, size: 10, fonts });
    y -= 20;
    drawMixedText(page, `Customer: ${invoice.customer_name}`, { x: 50, y, size: 10, fonts });
    y -= 30;
    drawMixedText(page, 'Description', { x: 50, y, size: 10, fonts, bold: true });
    drawMixedText(page, 'Qty', { x: 300, y, size: 10, fonts, bold: true });
    drawMixedText(page, 'Price', { x: 350, y, size: 10, fonts, bold: true });
    drawMixedText(page, 'Total', { x: 450, y, size: 10, fonts, bold: true });
    y -= 5;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: grey });
    y -= 15;
  }

  // Header (first page)
  drawMixedText(page, 'RupRong Inventory', { x: 50, y, size: 20, fonts, bold: true, color: gold });
  y -= 30;
  drawMixedText(page, `Invoice: ${invoice.invoice_no}`, { x: 50, y, size: 12, fonts, bold: true });
  y -= 20;
  drawMixedText(page, `Date: ${invoice.invoice_date}`, { x: 50, y, size: 10, fonts });
  y -= 20;
  drawMixedText(page, `Customer: ${invoice.customer_name}`, { x: 50, y, size: 10, fonts });
  if (invoice.customer_phone) { y -= 15; drawMixedText(page, `Phone: ${invoice.customer_phone}`, { x: 50, y, size: 10, fonts }); }
  if (invoice.customer_address) { y -= 15; drawMixedText(page, `Address: ${invoice.customer_address}`, { x: 50, y, size: 10, fonts }); }
  if (invoice.parcel_id) { y -= 15; drawMixedText(page, `Parcel ID: ${invoice.parcel_id}`, { x: 50, y, size: 10, fonts }); }

  y -= 30;

  // Table header
  drawMixedText(page, 'Description', { x: 50, y, size: 10, fonts, bold: true });
  drawMixedText(page, 'Qty', { x: 300, y, size: 10, fonts, bold: true });
  drawMixedText(page, 'Price', { x: 350, y, size: 10, fonts, bold: true });
  drawMixedText(page, 'Total', { x: 450, y, size: 10, fonts, bold: true });
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: grey });
  y -= 15;

  // Items — paginate instead of drawing off the page
  for (const item of items) {
    if (y < 100) newPage(true);
    drawMixedText(page, item.description, { x: 50, y, size: 9, fonts });
    drawMixedText(page, String(item.quantity), { x: 300, y, size: 9, fonts });
    drawMixedText(page, parseFloat(item.unit_price).toFixed(2), { x: 350, y, size: 9, fonts });
    drawMixedText(page, parseFloat(item.line_total).toFixed(2), { x: 450, y, size: 9, fonts });
    y -= 15;
  }

  if (y < 120) newPage(true);
  y -= 10;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: grey });
  y -= 20;

  // Totals
  const subtotal = items.reduce((s, i) => s + parseFloat(i.line_total), 0);
  drawMixedText(page, `Subtotal: ${subtotal.toFixed(2)}`, { x: 350, y, size: 10, fonts });
  y -= 15;
  if (parseFloat(invoice.discount_value) > 0) {
    drawMixedText(page, `Discount: -${parseFloat(invoice.discount_value).toFixed(2)}`, { x: 350, y, size: 10, fonts });
    y -= 15;
  }
  if (parseFloat(invoice.delivery_charge) > 0) {
    drawMixedText(page, `Delivery: +${parseFloat(invoice.delivery_charge).toFixed(2)}`, { x: 350, y, size: 10, fonts });
    y -= 15;
  }
  drawMixedText(page, `Total: ${parseFloat(invoice.total).toFixed(2)}`, { x: 350, y, size: 12, fonts, bold: true });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_no}.pdf"` },
  });
}
