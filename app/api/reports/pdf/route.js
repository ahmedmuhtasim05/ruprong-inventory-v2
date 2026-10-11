import { NextResponse } from 'next/server';
import { getReportSummary } from '../../../../lib/reports';
import { PDFDocument, rgb } from 'pdf-lib';
import { embedFonts, drawMixedText } from '../../../../lib/pdf-font';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const summary = await getReportSummary(start, end);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const fonts = await embedFonts(pdfDoc);
  const gold = rgb(0.72, 0.53, 0.04);

  let y = 800;
  drawMixedText(page, 'RupRong Inventory - Sales Report', { x: 50, y, size: 18, fonts, bold: true, color: gold });
  y -= 30;
  drawMixedText(page, `Period: ${start} to ${end}`, { x: 50, y, size: 10, fonts });
  y -= 30;

  const t = summary.totals;
  drawMixedText(page, `Invoices: ${t.invoiceCount}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Gross Sales: ${t.subtotal.toFixed(2)}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Discount: ${t.discount.toFixed(2)}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Delivery: ${t.delivery.toFixed(2)}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Net Revenue: ${t.revenue.toFixed(2)}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Cost of Goods: ${t.cost.toFixed(2)}`, { x: 50, y, size: 10, fonts }); y -= 15;
  drawMixedText(page, `Net Profit: ${t.profit.toFixed(2)}`, { x: 50, y, size: 12, fonts, bold: true }); y -= 15;
  drawMixedText(page, `Margin: ${t.marginPct.toFixed(1)}%`, { x: 50, y, size: 10, fonts });

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=report.pdf' },
  });
}
