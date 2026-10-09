'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { nextSerialSku } from '../../../lib/sku';

const CATEGORIES = ['Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 'Anklet', 'Pendant', 'Chain', 'Set', 'Other'];
const EMPTY_FORM = { id: null, sku: '', name: '', category: '', quantity: '0', price: '', cost_price: '', notes: '', image_url: '' };

// Days a product spent (or has been) sitting unsold in inventory.
// The clock counts from when the product was inserted and STOPS the
// moment stock reaches zero (sold out), using sold_out_at.
function agingDays(item) {
  const startMs = new Date(item.created_at).getTime();
  if (Number.isNaN(startMs)) return '—';
  const endMs = item.quantity > 0
    ? Date.now()
    : (item.sold_out_at ? new Date(item.sold_out_at).getTime() : Date.now());
  if (Number.isNaN(endMs)) return '—';
  return Math.max(0, Math.floor((endMs - startMs) / 86400000));
}

// Lazy thumbnail: only items flagged has_image trigger a request,
// and only for their own image — list payloads stay small.
// The updated_at version busts the browser cache whenever the product
// is saved, so a replaced photo shows up immediately instead of
// serving the stale cached copy for up to an hour.
function ItemThumb({ item, onOpen }) {
  const src = item.has_image
    ? `/api/items/${item.id}/image?v=${encodeURIComponent(item.updated_at || '')}`
    : null;

  if (!src) {
    return <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f4f0ea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>—</div>;
  }
  return <img src={src} alt={item.name} loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => onOpen(src)} />;
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  // Preview for the edit form. Untouched edits show the stored photo
  // straight from the image endpoint; the heavy base64 never enters
  // React state unless the user uploads a replacement.
  const [previewSrc, setPreviewSrc] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const imageTouchedRef = useRef(false);

  const load = useCallback(async (q) => {
    const res = await fetch(`/api/items?search=${encodeURIComponent(q || '')}`);
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

  // Sticky column header, one mechanism for every screen:
  // the real header row scrolls away with the table, and
  // a fixed clone of it (.sticky-thead in globals.css)
  // pins under the navbar on phones — or under the pinned
  // Add Item card on desktop/laptop (>=769px, where that
  // card sticks). Column widths and the horizontal offset
  // are synced to the real table so the clone lines up.
  // The real th stays static on purpose: a page-level
  // sticky th would stick mid-list on tablets and narrow
  // desktop windows, where the table's horizontal-scroll
  // wrapper is not active.
  const addCardRef = useRef(null);
  const tableWrapRef = useRef(null);
  const [navH, setNavH] = useState(60);
  const [addH, setAddH] = useState(0);
  // True at >=769px, where the Add Item card pins under
  // the navbar — the header then pins below it.
  const [desktopLayout, setDesktopLayout] = useState(false);
  // { top, width, colWidths, left } while the pinned
  // header is visible; null otherwise.
  const [stickyHead, setStickyHead] = useState(null);

  // Measure the navbar once and expose it as --nav-h so
  // CSS can pin elements exactly below it.
  useEffect(() => {
    function measureNav() {
      const nav = document.querySelector('.nav');
      const h = nav ? nav.offsetHeight : 60;
      setNavH(h);
      document.documentElement.style.setProperty('--nav-h', `${h}px`);
    }
    measureNav();
    window.addEventListener('resize', measureNav);
    return () => window.removeEventListener('resize', measureNav);
  }, []);

  // Track the layout class: >=769px the Add Item
  // card is sticky (see .add-item-card in
  // globals.css), so the pinned header sits below
  // it instead of directly under the navbar.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const update = () => setDesktopLayout(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    function update() {
      setAddH(addCardRef.current ? addCardRef.current.offsetHeight : 0);
    }
    update();
    window.addEventListener('resize', update);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      if (addCardRef.current) ro.observe(addCardRef.current);
    }
    return () => { window.removeEventListener('resize', update); if (ro) ro.disconnect(); };
  }, []);

  // The real header stays static — the fixed clone
  // below is the only pinned header, on every
  // screen size.
  const thStyle = { background: 'var(--card-bg)' };

  // Pinned header clone: while the table's own
  // header row is scrolled past the pin line (the
  // navbar on phones, or the navbar + pinned Add
  // Item card on desktop), show a fixed clone that
  // stays on that line. Column widths and the
  // horizontal offset are synced to the real table
  // so the clone lines up exactly.
  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    let raf = 0;

    function update() {
      raf = 0;
      const nav = document.querySelector('.nav');
      const nh = nav ? nav.offsetHeight : 60;
      const pin = desktopLayout
        ? nh + (addCardRef.current ? addCardRef.current.offsetHeight : 0)
        : nh;
      const rect = wrap.getBoundingClientRect();
      const head = wrap.querySelector('thead');
      const headTop = head ? head.getBoundingClientRect().top : rect.top;
      // Take over once the real header scrolls past
      // the pin line; drop when the table's bottom
      // passes it.
      if (headTop < pin && rect.bottom > pin) {
        const table = wrap.querySelector('table');
        const ths = wrap.querySelectorAll('thead th');
        const next = {
          top: pin,
          width: table ? table.offsetWidth : 0,
          colWidths: Array.from(ths).map((th) => th.offsetWidth),
          left: wrap.scrollLeft,
        };
        setStickyHead((s) =>
          s && s.top === next.top && s.width === next.width && s.left === next.left
            ? s
            : next
        );
      } else {
        setStickyHead((s) => (s ? null : s));
      }
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    wrap.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      wrap.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [desktopLayout, addH, items]);

  function flash(setter, msg) {
    setter(msg);
    setTimeout(() => setter(''), 4000);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Upload failed.'); return; }
      imageTouchedRef.current = true;
      setForm((prev) => ({ ...prev, image_url: data.url }));
      setPreviewSrc(data.url);
      flash(setSuccess, `Image uploaded and optimized (${data.sizeKB}KB).`);
    } catch {
      setError('Upload failed.');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      sku: form.sku, name: form.name, category: form.category,
      quantity: parseInt(form.quantity, 10) || 0, price: parseFloat(form.price) || 0,
      cost_price: form.cost_price === '' ? null : parseFloat(form.cost_price),
      notes: form.notes,
    };
    const isEdit = !!form.id;
    // Send the photo only when it changed in this session: a new data URL
    // replaces the stored one, '' (removed) clears it, and an untouched
    // edit keeps whatever is already saved server-side.
    if (!isEdit || imageTouchedRef.current) {
      payload.image_url = form.image_url || null;
    }
    const res = await fetch(isEdit ? `/api/items/${form.id}` : '/api/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
    setForm(EMPTY_FORM);
    setPreviewSrc(null);
    flash(setSuccess, isEdit ? 'Item updated.' : 'Item added.');
    load(search);
  }

  function editRow(item) {
    imageTouchedRef.current = false;
    setForm({ id: item.id, sku: item.sku, name: item.name, category: item.category || '', quantity: String(item.quantity), price: String(item.price), cost_price: item.cost_price == null ? '' : String(item.cost_price), notes: item.notes || '', image_url: '' });
    // Preview the stored photo straight from the image endpoint.
    // The base64 stays server-side; handleSubmit only sends
    // image_url when the user uploads or removes a photo, so
    // there is no async fetch that can race with those actions.
    setPreviewSrc(item.has_image ? `/api/items/${item.id}/image?v=${encodeURIComponent(item.updated_at || '')}` : null);
  }

  async function deleteRow(id) {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (form.id === id) { setForm(EMPTY_FORM); setPreviewSrc(null); }
    flash(setSuccess, 'Item deleted.');
    load(search);
  }

  function toggleSelect(id) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function exportCsv() {
    const ids = [...selected];
    const url = ids.length ? `/api/items/export?ids=${ids.join(',')}` : '/api/items/export';
    window.location.href = url;
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      let res;
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        res = await fetch('/api/items/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excel: base64 }) });
      } else {
        const text = await file.text();
        res = await fetch('/api/items/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv: text }) });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Import failed.'); }
      else { setImportSummary(data); load(search); }
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);
  const nextSku = nextSerialSku(items.map((it) => it.sku));

  // Header cells are shared by the real table and the
  // pinned mobile clone so both render identically.
  const headerCells = (style) => (
    <>
      <th style={style}></th>
      <th style={style}>Image</th>
      <th style={style}>SKU</th>
      <th style={style}>Name</th>
      <th style={style}>Category</th>
      <th style={style}>Qty</th>
      <th style={style}>Price</th>
      <th style={style}>Cost</th>
      <th style={style}>Aging Days</th>
      <th style={style}></th>
    </>
  );

  return (
    <div>
      <h2 style={{ color: 'var(--primary)' }}>Inventory</h2>
      {error && <div className="msg msg-error">{error}</div>}
      {success && <div className="msg msg-success">{success}</div>}

      <div className="card add-item-card" ref={addCardRef}>
        <h2>{form.id ? 'Edit Item' : 'Add Item'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="field"><label>SKU (blank = auto, next: {nextSku})</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={nextSku} /></div>
            <div className="field"><label>Name*</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Category</label><input list="categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><datalist id="categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field"><label>Quantity*</label><input required type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="field"><label>Selling Price*</label><input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="field"><label>Cost Price</label><input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: '100%' }} /></div>
          </div>
          <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
            <div className="field">
              <label>Product Image (auto-optimized to &lt;150KB)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="btn" style={{ marginBottom: 0, cursor: 'pointer' }}>
                  {uploading ? 'Optimizing...' : 'Upload Image'}
                  <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploading} />
                </label>
                {previewSrc && (
                  <>
                    <img src={previewSrc} alt="Preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => setLightboxImage(previewSrc)} />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => { imageTouchedRef.current = true; setForm({ ...form, image_url: '' }); setPreviewSrc(null); }}>Remove</button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary">{form.id ? 'Update Item' : 'Add Item'}</button>
            {form.id && <button type="button" className="btn" onClick={() => { setForm(EMPTY_FORM); setPreviewSrc(null); }}>Cancel Edit</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="field"><label>Search</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, SKU, or category" /></div>
          <div className="row">
            <button className="btn" onClick={exportCsv}>Export {selected.size ? `Selected (${selected.size})` : 'All'} to CSV</button>
            <label className="btn" style={{ marginBottom: 0 }}>{importing ? 'Importing...' : 'Bulk Import CSV / Excel'}<input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFile} style={{ display: 'none' }} disabled={importing} /></label>
          </div>
        </div>
        {importSummary && (
          <div className="msg msg-success" style={{ marginTop: 10 }}>
            Import done: {importSummary.inserted} added, {importSummary.updated} updated
            {importSummary.nextSku ? ` — next SKU: ${importSummary.nextSku}` : ''}
            {importSummary.errors.length > 0 && `, ${importSummary.errors.length} row(s) skipped`}.
          </div>
        )}
        <p className="muted" style={{ marginTop: 8 }}>CSV/Excel columns: SKU, Name, Category, Quantity, Selling Price, Cost Price, Notes</p>
        <p className="muted">{items.length} item types | {totalUnits} units in stock</p>
      </div>

      <div className="card">
        <div className="table-wrap-sticky" ref={tableWrapRef}>
          <table>
            <thead><tr>{headerCells(thStyle)}</tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.quantity <= 3 ? 'low-stock' : ''}>
                  <td><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} /></td>
                  <td><ItemThumb item={it} onOpen={setLightboxImage} /></td>
                  <td>{it.sku}</td><td>{it.name}</td><td>{it.category}</td><td>{it.quantity}</td>
                  <td>{Number(it.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>{it.cost_price != null ? Number(it.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                  <td>{it.quantity > 0 ? agingDays(it) : <span style={{ color: '#999' }} title="Counting stopped — this product is out of stock">{agingDays(it)}</span>}</td>
                  <td><button className="btn btn-sm" onClick={() => editRow(it)}>Edit</button> <button className="btn btn-sm btn-danger" onClick={() => deleteRow(it.id)}>Delete</button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 20, textAlign: 'center' }}>No items yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pinned column header (phones/tablets): fixed
          copy of the header row that stays under the
          navbar while the table scrolls. */}
      {stickyHead && (
        <div className="sticky-thead" style={{ top: stickyHead.top }}>
          <div
            className="sticky-thead-inner"
            style={{ width: stickyHead.width, transform: `translateX(${-stickyHead.left}px)` }}
          >
            <table>
              <colgroup>
                {stickyHead.colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead><tr>{headerCells({ background: 'var(--card-bg)' })}</tr></thead>
            </table>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Product" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
