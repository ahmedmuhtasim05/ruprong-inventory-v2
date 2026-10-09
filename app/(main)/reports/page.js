'use client';
import { useState } from 'react';

function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function toISO(d) { return d.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const today = new Date();
  const [start, setStart] = useState(toISO(firstOfMonth(today)));
  const [end, setEnd] = useState(toISO(today));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`/api/reports/summary?start=${start}&end=${end}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not generate report.'); return; }
      setSummary(data.summary);
    } finally { setLoading(false); }
  }

  function quickRange(kind) {
    const now = new Date();
    if (kind === 'week') { const day = now.getDay(); const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7)); setStart(toISO(monday)); setEnd(toISO(now)); }
    else if (kind === 'month') { setStart(toISO(firstOfMonth(now))); setEnd(toISO(now)); }
    else if (kind === 'lastMonth') { const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1); setStart(toISO(lastMonthStart)); setEnd(toISO(lastMonthEnd)); }
  }

  const t = summary?.totals;
  const u = summary?.unsold;

  return (
    <div>
      <h2 style={{ color: 'var(--primary)' }}>Sales & Profit Report</h2>
      {error && <div className="msg msg-error">{error}</div>}
      <div className="card">
        <h2>Date Range</h2>
        <div className="row">
          <div className="field"><label>From</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field"><label>To</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? 'Loading...' : 'Generate Report'}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}><span className="muted">Quick:</span><button className="btn btn-sm" onClick={() => quickRange('week')}>This Week</button><button className="btn btn-sm" onClick={() => quickRange('month')}>This Month</button><button className="btn btn-sm" onClick={() => quickRange('lastMonth')}>Last Month</button></div>
      </div>
      <div className="card">
        <h2>Summary</h2>
        {!summary ? <p className="muted">Choose a date range and click Generate.</p> : (
          <div>
            <div className="stats-grid">
              <div className="stat-card"><div className="value">{t.invoiceCount}</div><div className="label">Invoices</div></div>
              <div className="stat-card"><div className="value">{t.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Net Revenue</div></div>
              <div className="stat-card"><div className="value">{t.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Net Profit</div></div>
              <div className="stat-card"><div className="value">{t.marginPct.toFixed(1)}%</div><div className="label">Margin</div></div>
            </div>
            <p>Gross Sales: {t.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Discount: {t.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Delivery: {t.delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p>Cost of Goods: {t.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>
      {summary && (
        <>
          <div className="row" style={{ marginBottom: 16 }}><a className="btn" href={`/api/reports/pdf?start=${start}&end=${end}`} target="_blank" rel="noreferrer">Download PDF</a><a className="btn" href={`/api/reports/xlsx?start=${start}&end=${end}`}>Download Excel</a></div>
          <div className="card"><h2>By Invoice</h2><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Subtotal</th><th>Discount</th><th>Delivery</th><th>Total</th><th>Cost</th><th>Profit</th></tr></thead><tbody>{summary.byInvoice.map((r) => <tr key={r.invoice_no}><td>{r.invoice_no}</td><td>{r.date}</td><td>{r.customer}</td><td>{r.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.delivery.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div></div>
          <div className="card"><h2>By Product</h2><div className="table-wrap"><table><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead><tbody>{summary.byProduct.map((r) => <tr key={r.description}><td>{r.description}</td><td>{r.qty}</td><td>{r.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td>{r.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div></div>
          <div className="card"><h2>Unsold Inventory</h2>
            <div className="stats-grid">
              <div className="stat-card"><div className="value">{u.totalItems}</div><div className="label">Item Types</div></div>
              <div className="stat-card"><div className="value">{u.totalQty}</div><div className="label">Total Qty</div></div>
              <div className="stat-card"><div className="value">{u.costValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Cost Value</div></div>
              <div className="stat-card"><div className="value">{u.retailValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Retail Value</div></div>
              <div className="stat-card"><div className="value">{u.profitPotential.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div><div className="label">Potential Profit</div></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
