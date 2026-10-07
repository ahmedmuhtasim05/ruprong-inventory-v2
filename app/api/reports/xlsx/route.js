import { NextResponse } from 'next/server';
import { getReportSummary } from '../../../../lib/reports';
import * as XLSX from 'xlsx';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const summary = await getReportSummary(start, end);

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Metric', 'Value'],
    ['Invoices', summary.totals.invoiceCount],
    ['Gross Sales', summary.totals.subtotal],
    ['Discount', summary.totals.discount],
    ['Delivery', summary.totals.delivery],
    ['Net Revenue', summary.totals.revenue],
    ['Cost of Goods', summary.totals.cost],
    ['Net Profit', summary.totals.profit],
    ['Margin %', summary.totals.marginPct.toFixed(1)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // By Invoice sheet
  const invData = [['Invoice', 'Date', 'Customer', 'Subtotal', 'Discount', 'Delivery', 'Total', 'Cost', 'Profit']];
  for (const r of summary.byInvoice) {
    invData.push([r.invoice_no, r.date, r.customer, r.subtotal, r.discount, r.delivery, r.total, r.cost, r.profit]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(invData);
  XLSX.utils.book_append_sheet(wb, ws2, 'By Invoice');

  // By Product sheet
  const prodData = [['Product', 'Qty Sold', 'Revenue', 'Cost', 'Profit']];
  for (const r of summary.byProduct) {
    prodData.push([r.description, r.qty, r.revenue, r.cost, r.profit]);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(prodData);
  XLSX.utils.book_append_sheet(wb, ws3, 'By Product');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename=report.xlsx' },
  });
}
