import { db } from '../../../../../lib/db';
import PrintActions from './PrintActions';

// Browser print view of a single invoice.
// Rendering here (instead of only the pdf-lib PDF) means the browser
// does full Bangla text shaping, so Bangla product/customer names
// print with proper spelling and conjuncts.
export default async function InvoicePrintPage({ params }) {
  const { id } = await params;
  const invResult = await db.query('SELECT * FROM invoices WHERE id = $1', [id]);
  const invoice = invResult.rows[0];

  if (!invoice) {
    return (
      <div>
        <h2 style={{ color: 'var(--primary)' }}>Invoice not found</h2>
        <div className="card"><p className="muted">This invoice may have been deleted.</p></div>
      </div>
    );
  }

  const itemsResult = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id', [id]);
  const items = itemsResult.rows;

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.line_total) || 0), 0);
  const dVal = parseFloat(invoice.discount_value) || 0;
  const discountAmount = invoice.discount_type === 'percent' ? subtotal * (dVal / 100) : dVal;
  const delivery = parseFloat(invoice.delivery_charge) || 0;
  const fmt = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateStr = new Date(invoice.invoice_date).toISOString().slice(0, 10);

  const cell = { border: '1px solid #e5e0d8', padding: '8px 10px', fontSize: 13 };
  const headCell = { ...cell, background: '#faf8f5', fontWeight: 600, textAlign: 'left' };

  return (
    <div>
      <PrintActions />
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', padding: '36px 40px', border: '1px solid #e5e0d8', borderRadius: 8 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid var(--primary)', paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>RupRong Inventory</div>
            <div className="muted">By Ananna</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>INVOICE</div>
            <div style={{ fontWeight: 600 }}>{invoice.invoice_no}</div>
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="muted" style={{ marginBottom: 2 }}>Date</div>
            <div style={{ fontWeight: 600 }}>{dateStr}</div>
          </div>
          {invoice.customer_phone && (
            <div>
              <div className="muted" style={{ marginBottom: 2 }}>Phone</div>
              <div style={{ fontWeight: 600 }}>{invoice.customer_phone}</div>
            </div>
          )}
          {invoice.parcel_id && (
            <div>
              <div className="muted" style={{ marginBottom: 2 }}>Parcel ID</div>
              <div style={{ fontWeight: 600 }}>{invoice.parcel_id}</div>
            </div>
          )}
        </div>

        {/* Customer */}
        <div style={{ marginBottom: 20 }}>
          <div className="muted" style={{ marginBottom: 2 }}>Customer</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{invoice.customer_name}</div>
          {invoice.customer_address && <div style={{ marginTop: 2, color: '#555' }}>{invoice.customer_address}</div>}
        </div>

        {/* Items */}
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...headCell, width: 36, textAlign: 'center' }}>#</th>
              <th style={headCell}>Description</th>
              <th style={{ ...headCell, width: 60, textAlign: 'right' }}>Qty</th>
              <th style={{ ...headCell, width: 90, textAlign: 'right' }}>Price</th>
              <th style={{ ...headCell, width: 100, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((li, i) => (
              <tr key={li.id || i}>
                <td style={{ ...cell, textAlign: 'center', color: '#999' }}>{i + 1}</td>
                <td style={cell}>{li.description}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{li.quantity}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmt(li.unit_price)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmt(li.line_total)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} style={{ ...cell, textAlign: 'center', color: '#999' }}>No items.</td></tr>}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <div style={{ minWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
              <span className="muted">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span className="muted">Discount{invoice.discount_type === 'percent' ? ` (${dVal}%)` : ''}</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {delivery > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span className="muted">Delivery</span>
                <span>+{fmt(delivery)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: 6, borderTop: '2px solid var(--primary)', fontSize: 17, fontWeight: 700, color: 'var(--primary)' }}>
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </div>

        <div className="muted" style={{ textAlign: 'center', marginTop: 40, fontSize: 12 }}>Thank you for your purchase</div>
      </div>
    </div>
  );
}
