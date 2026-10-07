import { NextResponse } from 'next/server';
import { getReportSummary } from '../../../../lib/reports';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const summary = await getReportSummary(start, end);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  page.drawText('RupRong Inventory - Sales Report', { x: 50, y, size: 18, font: boldFont, color: rgb(0.72, 0.53, 0.04) });
  y -= 30;
  page.drawText(`Period: ${start} to ${end}`, { x: 50, y, size: 10, font });
  y -= 30;

  const t = summary.totals;
  page.drawText(`Invoices: ${t.invoiceCount}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Gross Sales: ${t.subtotal.toFixed(2)}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Discount: ${t.discount.toFixed(2)}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Delivery: ${t.delivery.toFixed(2)}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Net Revenue: ${t.revenue.toFixed(2)}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Cost of Goods: ${t.cost.toFixed(2)}`, { x: 50, y, size: 10, font }); y -= 15;
  page.drawText(`Net Profit: ${t.profit.toFixed(2)}`, { x: 50, y, size: 12, font: boldFont }); y -= 15;
  page.drawText(`Margin: ${t.marginPct.toFixed(1)}%`, { x: 50, y, size: 10, font });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=report.pdf' },
  });
}
