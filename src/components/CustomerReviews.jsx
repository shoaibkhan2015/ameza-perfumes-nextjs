'use client';
import { useId, useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { useReviews } from '../lib/use-reviews.js';
import { reviewStars } from '../lib/reviews.js';
import * as C from '../data/siteContent.js';
import '../styles/reviews.css';

export function ReviewRating({ summary }) {
  return <><span className="am-stars" aria-label={summary.count ? `${summary.average} out of 5 stars` : 'Not yet rated'}>{reviewStars(summary.average)}</span> {summary.count ? Number(summary.average).toFixed(1) : 'Not yet rated'} · {summary.count} reviews</>;
}

function ReviewForm({ product }) {
  const id = useId();
  const { token } = useAuth();
  const { data, error: productsError } = useApi('/reviews/products');
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const products = product ? [product] : data?.products || [];
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api('/reviews', { method: 'POST', token, body: {
        productId: product?.id || values.get('productId'), name: values.get('name'), city: values.get('city'),
        rating: Number(values.get('rating')), feedback: values.get('feedback'), website: values.get('website'), startedAt,
      } });
      setMessage(result.message); form.reset(); setStartedAt(Date.now());
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <details className="am-review-write">
    <summary className="am-btn">Write a review</summary>
    <form className="am-review-form" onSubmit={submit} aria-label="Submit a customer review">
      <p>Everyone is welcome to review. Reviews appear after approval.</p>
      <div className="am-review-fields">
        <label htmlFor={`${id}-name`}>Name<input id={`${id}-name`} name="name" required minLength={2} maxLength={80} autoComplete="name" disabled={busy} /></label>
        <label htmlFor={`${id}-city`}>City (optional)<input id={`${id}-city`} name="city" maxLength={80} autoComplete="address-level2" disabled={busy} /></label>
        <label htmlFor={`${id}-product`}>Perfume<select id={`${id}-product`} name="productId" required defaultValue={product?.id || ''} disabled={busy || !!product || !products.length}>
          {!product && <option value="">Choose a perfume</option>}
          {products.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>
        <label htmlFor={`${id}-rating`}>Rating<select id={`${id}-rating`} name="rating" defaultValue="" required disabled={busy}><option value="">Choose a rating</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} {value === 1 ? 'star' : 'stars'}</option>)}</select></label>
      </div>
      <label htmlFor={`${id}-feedback`}>Your review<textarea id={`${id}-feedback`} name="feedback" required minLength={10} maxLength={2000} rows={4} disabled={busy} /></label>
      <div className="am-review-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {productsError && !product && <p role="alert">Perfumes could not be loaded. Please refresh and try again.</p>}
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <button className="am-btn" disabled={busy || !products.length}>{busy ? 'Submitting…' : 'Submit review'}</button>
    </form>
  </details>;
}

function ReviewCard({ review, demo, index, showDate }) {
  return <div className="am-rc" data-reveal style={{ '--i': index }}>
    {!demo && showDate && <time>{new Date(review.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi' })}</time>}
    <span className="am-stars" aria-label={demo ? 'Sample rating' : `${review.rating} out of 5 stars`}>{reviewStars(demo ? 5 : review.rating)}</span>
    {review.product_title && <h4>{review.product_title}</h4>}
    <p>{demo ? review.text : review.feedback}</p>
    {demo ? <small>Sample/demo review — not a customer testimonial</small> : review.verified_purchase && <small>✓ Verified Purchase</small>}
    <b>{review.name}{review.city ? ` · ${review.city}` : ''}</b>
  </div>;
}

export default function CustomerReviews({ product, feed }) {
  const ownFeed = useReviews(product?.id, !feed);
  const { data, loading, error, page, setPage, reload } = feed || ownFeed;
  const r = product ? C.pdpReviews : C.reviews;
  const summary = data.summary;
  const ratings = loading ? <span role="status">Loading ratings…</span> : error ? <span>Ratings unavailable</span> : <ReviewRating summary={summary} />;
  const demo = !loading && summary.count === 0;
  const cards = demo ? r.items : data.reviews;
  const cardList = <>
    {loading && <p role="status">Loading reviews…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={reload}>Try again</button></p>}
    {demo && <p className="am-review-demo">{error ? 'Reviews are unavailable. Showing sample/demo content.' : 'No approved reviews yet. These samples show how reviews will look.'} Samples do not count toward ratings.</p>}
    <div className={product ? 'rv-list' : 'am-rail'}>{cards.map((review, index) => <ReviewCard key={review.id || `demo-${index}`} review={review} demo={demo} showDate={!!product} index={index} />)}</div>
    {(page > 1 || data.hasMore) && <nav className="am-review-pages" aria-label="Review pages">
      <button type="button" className="am-btn" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button>
      <span>Page {page}</span><button type="button" className="am-btn" disabled={!data.hasMore || loading} onClick={() => setPage(value => value + 1)}>Next</button>
    </nav>}
  </>;
  return <section className="am-sec am-rev" id={product ? 'reviews' : 'customer-reviews'}><div className="am-wrap">
    <div className="am-head" data-reveal><div><p className="am-eb">{product ? r.eyebrow : 'Customer reviews'}</p><h2 className="am-h">{r.heading}</h2></div>
      {!product && <div style={{ textAlign: 'right' }}><div className="am-sum">{!loading && !error && summary.count ? Number(summary.average).toFixed(1) : '—'}</div>{ratings}</div>}
    </div>
    {product ? <div className="rv"><div className="rv-sum" data-reveal>
      <div className="am-sum">{!loading && !error && summary.count ? Number(summary.average).toFixed(1) : '—'}</div>{ratings}
      {[5, 4, 3, 2, 1].map(star => {
        const percent = !loading && !error && summary.count ? Math.round(100 * summary.distribution[star] / summary.count) : 0;
        return <div className="rb" key={star}>{star}★<i><u style={{ '--w': `${percent}%` }} /></i><span>{percent}%</span></div>;
      })}
    </div><div>{cardList}</div></div> : cardList}
    <ReviewForm key={product?.id || 'all'} product={product} />
  </div></section>;
}
