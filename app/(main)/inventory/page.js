'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { nextSerialSku } from '../../../lib/sku';

const CATEGORIES = ['Ring', 'Necklace', 'Earring', 'Bracelet', 'Bangle', 'Anklet', 'Pendant', 'Chain', 'Set', 'Other'];
const EMPTY_FORM = { id: null, sku: '', name: '', category: '', quantity: '0', price: '', cost_price: '', notes: '', image_url: '' };

// Days a product has been sitting in inventory since it was inserted
function agingDays(createdAt) {
  if (!createdAt) return '—';
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return '—';
  return Math.max(0, Math.floor((Date.now() - created) / 86400000));
}

// Lazy thumbnail: only items flagged has_image trigger a request,
// and only for their own image — list payloads stay small.
function ItemThumb({ item, onOpen }) {
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(!item.has_image);

  useEffect(() => {
    if (!item.has_image) return;
    let alive = true;
    fetch(`/api/items/${item.id}/image`)
      .then((r) => r.json())
      .then((d) => { if (alive) { setUrl(d.image_url); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [item.id, item.has_image]);

  if (!loaded || !url) {
    return <div style={{ width: 40, height: 40, borderRadius: 4, background: '#f4f0ea', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>—</div>;
  }
  return <img src={url} alt={item.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => onOpen(url)} />;
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
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const load = useCallback(async (q) => {
    const res = await fetch(`/api/items?search=${encodeURIComponent(q || '')}`);
    const data = await res.json();
    setItems(data.items || []);
  }, []);

  useEffect(() => { load(search); }, [search, load]);

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
      setForm((prev) => ({ ...prev, image_url: data.url }));
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
      notes: form.notes, image_url: form.image_url || null,
    };
    const isEdit = !!form.id;
    const res = await fetch(isEdit ? `/api/items/${form.id}` : '/api/items', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
    setForm(EMPTY_FORM);
    flash(setSuccess, isEdit ? 'Item updated.' : 'Item added.');
    load(search);
  }

  function editRow(item) {
    setForm({ id: item.id, sku: item.sku, name: item.name, category: item.category || '', quantity: String(item.quantity), price: String(item.price), cost_price: item.cost_price == null ? '' : String(item.cost_price), notes: item.notes || '', image_url: '' });
    // Load the stored image on demand so edits keep it
    if (item.has_image) {
      fetch(`/api/items/${item.id}/image`)
        .then((r) => r.json())
        .then((d) => setForm((prev) => (prev.id === item.id ? { ...prev, image_url: d.image_url || '' } : prev)))
        .catch(() => {});
    }
  }

  async function deleteRow(id) {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (form.id === id) setForm(EMPTY_FORM);
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

  return (
    <div>
      <h2 style={{ color: 'var(--primary)' }}>Inventory</h2>
      {error && <div className="msg msg-error">{error}</div>}
      {success && <div className="msg msg-success">{success}</div>}

      <div className="card" style={{ position: 'sticky', top: 61, zIndex: 40, boxShadow: '0 6px 14px rgba(0,0,0,0.06)' }}>
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
                {form.image_url && (
                  <>
                    <img src={form.image_url} alt="Preview" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }} onClick={() => setLightboxImage(form.image_url)} />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setForm({ ...form, image_url: '' })}>Remove</button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-primary">{form.id ? 'Update Item' : 'Add Item'}</button>
            {form.id && <button type="button" className="btn" onClick={() => setForm(EMPTY_FORM)}>Cancel Edit</button>}
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
        <table>
          <thead><tr><th></th><th>Image</th><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Price</th><th>Cost</th><th>Aging Days</th><th></th></tr></thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className={it.quantity <= 3 ? 'low-stock' : ''}>
                <td><input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSelect(it.id)} /></td>
                <td><ItemThumb item={it} onOpen={setLightboxImage} /></td>
                <td>{it.sku}</td><td>{it.name}</td><td>{it.category}</td><td>{it.quantity}</td>
                <td>{Number(it.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td>{it.cost_price != null ? Number(it.cost_price).toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                <td>{agingDays(it.created_at)}</td>
                <td><button className="btn btn-sm" onClick={() => editRow(it)}>Edit</button> <button className="btn btn-sm btn-danger" onClick={() => deleteRow(it.id)}>Delete</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={10} className="muted" style={{ padding: 20, textAlign: 'center' }}>No items yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {lightboxImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }} onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Product" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
