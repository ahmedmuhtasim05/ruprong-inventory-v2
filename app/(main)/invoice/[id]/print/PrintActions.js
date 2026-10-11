'use client';

import { useState } from 'react';

// Actions above the printable invoice document. Hidden when printing.
//
// "Download PDF" renders the invoice with the browser's own text
// engine (so Bangla conjuncts and vowel signs shape correctly)
// into an A4 PDF — pdf-lib cannot shape Bangla, which broke the
// server-generated PDF in desktop PDF viewers.
export default function PrintActions({ invoiceNo }) {
  const [busy, setBusy] = useState(false);

  async function downloadPdf() {
    setBusy(true);
    try {
      const el = document.getElementById('invoice-doc');
      if (!el) return;
      const { default: html2pdf } = await import('html2pdf.js');
      await html2pdf()
        .set({
          margin: 0,
          filename: `invoice-${invoiceNo}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(el)
        .save();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-primary" onClick={downloadPdf} disabled={busy}>
        {busy ? 'Generating...' : 'Download PDF'}
      </button>
      <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
      <a className="btn" href="/history">Back to Invoice History</a>
    </div>
  );
}
