'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { reviewStars } from '../lib/reviews.js';

export default function AdminReviews({ products }) {
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    async function load() {
      let query = supabase.from('customer_reviews').select('id, product_id, name, city, rating, feedback, status, verified_purchase, created_at', { count: 'exact' });
      if (productId) query = query.eq('product_id', productId);
      if (status) query = query.eq('status', status);
      const result = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1);
      if (!active) return;
      if (result.error) { setError('Reviews could not be loaded. Check that supabase/reviews.sql has been applied.'); setReviews([]); }
      else { setReviews(result.data || []); setCount(result.count || 0); }
      setLoading(false);
    }
    load().catch(() => { if (active) { setError('Reviews could not be loaded. Please try again.'); setLoading(false); } });
    return () => { active = false; };
  }, [productId, status, page, revision]);

  async function moderate(review, action) {
    if (action === 'delete' && !window.confirm('Permanently delete this review?')) return;
    setBusy(true); setError('');
    try {
      const query = action === 'delete'
        ? supabase.from('customer_reviews').delete()
        : supabase.from('customer_reviews').update({ status: action });
      const { error: saveError } = await query.eq('id', review.id).select('id').single();
      if (saveError) throw saveError;
      if (page > 1 && reviews.length === 1) setPage(value => value - 1);
      else refresh();
    } catch { setError('The review could not be updated. Please try again.'); } finally { setBusy(false); }
  }
  return <section className="admin-panel">
    <div className="admin-panel__heading"><div><p className="admin-eyebrow">Moderation</p><h2>Customer reviews</h2><p className="admin-muted">Only approved reviews are public. Verified Purchase is checked against paid, delivered orders and cannot be set manually.</p></div><button type="button" className="admin-text-button" disabled={loading || busy} onClick={refresh}>Refresh</button></div>
    <div className="admin-fields-row">
      <label>Perfume<select value={productId} disabled={busy} onChange={event => { setProductId(event.target.value); setPage(1); }}><option value="">All perfumes</option>{products.map(product => <option key={product.id} value={product.id}>{product.title}</option>)}</select></label>
      <label>Status<select value={status} disabled={busy} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{['pending', 'approved', 'rejected'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    </div>
    {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading reviews…</p> : <>
      <p className="admin-muted">{count} reviews</p>
      {!reviews.length && <p>No reviews match these filters.</p>}
      {reviews.map(review => <article className="admin-panel" key={review.id}>
        <b>{products.find(product => product.id === review.product_id)?.title || 'Removed product'} · {reviewStars(review.rating)}</b>
        <p>{review.feedback}</p><p>{review.name}{review.city ? ` · ${review.city}` : ''}</p>
        <p className="admin-muted">{review.status} · {new Date(review.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })}{review.verified_purchase ? ' · Verified Purchase' : ''}</p>
        <div className="admin-row-actions">
          <button type="button" className="admin-text-button" disabled={busy || review.status === 'approved'} onClick={() => moderate(review, 'approved')}>Approve</button>
          <button type="button" className="admin-text-button" disabled={busy || review.status === 'rejected'} onClick={() => moderate(review, 'rejected')}>Reject</button>
          <button type="button" className="admin-text-button admin-text-button--danger" disabled={busy} onClick={() => moderate(review, 'delete')}>Delete spam</button>
        </div>
      </article>)}
      <div className="admin-row-actions"><button type="button" className="admin-text-button" disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button type="button" className="admin-text-button" disabled={busy || page * 25 >= count} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </>}
  </section>;
}
