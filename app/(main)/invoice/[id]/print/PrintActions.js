'use client';

// Actions shown above the printable invoice document.
// Hidden automatically when printing via the @media print rules.
export default function PrintActions() {
  return (
    <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      <a className="btn" href="/history">Back to Invoice History</a>
    </div>
  );
}
