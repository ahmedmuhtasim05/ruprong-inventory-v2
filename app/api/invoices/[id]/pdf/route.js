import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(request, { params }) {
  const { id } = params;

  const invResult = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
  if (invResult.rows.length === 0) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const itemsResult = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [id]);
  const invoice = invResult.rows[0];
  const items = itemsResult.rows;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]); // A4
  let y = 800;

  // Start a new page with a repeated header (for long invoices)
  function newPage(continued) {
    page = pdfDoc.addPage([595, 842]);
    y = 800;
    page.drawText('RupRong Inventory', { x: 50, y, size: 16, font: boldFont, color: rgb(0.72, 0.53, 0.04) });
    y -= 28;
    page.drawText(`Invoice: ${invoice.invoice_no}${continued ? ' (continued)' : ''}`, { x: 50, y, size: 12, font: boldFont });
    y -= 20;
    page.drawText(`Date: ${invoice.invoice_date}`, { x: 50, y, size: 10, font });
    y -= 20;
    page.drawText(`Customer: ${invoice.customer_name}`, { x: 50, y, size: 10, font });
    y -= 30;
    page.drawText('Description', { x: 50, y, size: 10, font: boldFont });
    page.drawText('Qty', { x: 300, y, size: 10, font: boldFont });
    page.drawText('Price', { x: 350, y, size: 10, font: boldFont });
    page.drawText('Total', { x: 450, y, size: 10, font: boldFont });
    y -= 5;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 15;
  }

  // Header (first page)
  page.drawText('RupRong Inventory', { x: 50, y, size: 20, font: boldFont, color: rgb(0.72, 0.53, 0.04) });
  y -= 30;
  page.drawText(`Invoice: ${invoice.invoice_no}`, { x: 50, y, size: 12, font: boldFont });
  y -= 20;
  page.drawText(`Date: ${invoice.invoice_date}`, { x: 50, y, size: 10, font });
  y -= 20;
  page.drawText(`Customer: ${invoice.customer_name}`, { x: 50, y, size: 10, font });
  if (invoice.customer_phone) { y -= 15; page.drawText(`Phone: ${invoice.customer_phone}`, { x: 50, y, size: 10, font }); }
  if (invoice.customer_address) { y -= 15; page.drawText(`Address: ${invoice.customer_address}`, { x: 50, y, size: 10, font }); }
  if (invoice.parcel_id) { y -= 15; page.drawText(`Parcel ID: ${invoice.parcel_id}`, { x: 50, y, size: 10, font }); }

  y -= 30;

  // Table header
  page.drawText('Description', { x: 50, y, size: 10, font: boldFont });
  page.drawText('Qty', { x: 300, y, size: 10, font: boldFont });
  page.drawText('Price', { x: 350, y, size: 10, font: boldFont });
  page.drawText('Total', { x: 450, y, size: 10, font: boldFont });
  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 15;

  // Items — paginate instead of drawing off the page
  for (const item of items) {
    if (y < 100) newPage(true);
    page.drawText(item.description, { x: 50, y, size: 9, font });
    page.drawText(String(item.quantity), { x: 300, y, size: 9, font });
    page.drawText(parseFloat(item.unit_price).toFixed(2), { x: 350, y, size: 9, font });
    page.drawText(parseFloat(item.line_total).toFixed(2), { x: 450, y, size: 9, font });
    y -= 15;
  }

  if (y < 120) newPage(true);
  y -= 10;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 20;

  // Totals
  const subtotal = items.reduce((s, i) => s + parseFloat(i.line_total), 0);
  page.drawText(`Subtotal: ${subtotal.toFixed(2)}`, { x: 350, y, size: 10, font });
  y -= 15;
  if (parseFloat(invoice.discount_value) > 0) {
    page.drawText(`Discount: -${parseFloat(invoice.discount_value).toFixed(2)}`, { x: 350, y, size: 10, font });
    y -= 15;
  }
  if (parseFloat(invoice.delivery_charge) > 0) {
    page.drawText(`Delivery: +${parseFloat(invoice.delivery_charge).toFixed(2)}`, { x: 350, y, size: 10, font });
    y -= 15;
  }
  page.drawText(`Total: ${parseFloat(invoice.total).toFixed(2)}`, { x: 350, y, size: 12, font: boldFont });

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_no}.pdf"` },
  });
}
