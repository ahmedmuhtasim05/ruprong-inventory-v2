'use client';
import { useEffect, useState, useCallback } from 'react';

// Product image with the inventory-style lightbox:
// clicking the photo opens a full-screen dark overlay with
// the image centered (click anywhere to close).
function ProductCard({ item, onOpenImage }) {
  const src = item.has_image
    ? `/api/items/${item.id}/image?v=${encodeURIComponent(item.updated_at || '')}`
    : null;

  return (
    <div className="product-card">
      {src ? (
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          className="product-card-img"
          onClick={() => onOpenImage(src)}
        />
      ) : (
        <div className="product-card-img product-card-img-empty">—</div>
      )}
      <div className="product-card-body">
        <div className="product-card-sku">{item.sku}</div>
        <div className="product-card-name">{item.name}</div>
        <div className="product-card-price">{Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        <div className={`product-card-stock${item.quantity > 0 ? '' : ' out'}`}>
          {item.quantity > 0 ? `Stock: ${item.quantity}` : 'Out of stock'}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/items');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h2 style={{ color: 'var(--primary)' }}>Products</h2>
      {loading ? (
        <div className="card"><p className="muted">Loading products...</p></div>
      ) : items.length === 0 ? (
        <div className="card"><p className="muted" style={{ textAlign: 'center', padding: 20 }}>No products yet.</p></div>
      ) : (
        <div className="product-grid">
          {items.map((it) => (
            <ProductCard key={it.id} item={it} onOpenImage={setLightboxImage} />
          ))}
        </div>
      )}
      {lightboxImage && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
          onClick={() => setLightboxImage(null)}
        >
          <img src={lightboxImage} alt="Product" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
