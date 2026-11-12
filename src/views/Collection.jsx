'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ProductCard from '../components/ProductCard.jsx';
import CollectionImage from '../components/CollectionImage.jsx';
import { Newsletter } from '../components/sections.jsx';
import NotFound from './NotFound.jsx';
import { useApi, useTitle } from '../lib/hooks.js';

const AV = 'filter.v.availability', GTE = 'filter.v.price.gte', LTE = 'filter.v.price.lte';

export function Pagination({ page, pages, hrefFor }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      {page > 1 && <span className="prev"><Link href={hrefFor(page - 1)}>« Previous</Link></span>}
      {Array.from({ length: pages }, (_, i) => i + 1).map(n => (n === page
        ? <span key={n} className="page current">{n}</span>
        : <span key={n} className="page"><Link href={hrefFor(n)}>{n}</Link></span>))}
      {page < pages && <span className="next"><Link href={hrefFor(page + 1)}>Next »</Link></span>}
    </div>
  );
}

// templates/collection.json  (sections/am-collection.liquid)
export default function Collection() {
  const { handle } = useParams();
  const sp = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const qs = sp.toString();
  const { data, error } = useApi(`/collections/${handle}?per_page=12&${qs}`, [handle, qs]);
  useTitle(data?.collection.title);
  if (error?.status === 404) return <NotFound />;
  if (!data) return <section className="am-sec" style={{ minHeight: '70vh' }} />;

  const { collection: c, products, total, page, pages, sortOptions, filters } = data;
  const sortBy = sortOptions.some(o => o.value === sp.get('sort_by')) ? sp.get('sort_by') : 'manual';
  const avail = sp.getAll(AV), gte = sp.get(GTE) ?? '', lte = sp.get(LTE) ?? '';
  const base = `/collections/${handle}`;
  const withParams = fn => { const n = new URLSearchParams(sp); fn(n); n.delete('page'); const s = n.toString(); return base + (s ? '?' + s : ''); };
  const hrefFor = p => { const n = new URLSearchParams(sp); n.set('page', p); return `${base}?${n}`; };

  // the old theme auto-submitted the filter form on every change — same here
  const onChange = e => {
    if (!e.target.matches('input,select')) return;
    const root = e.currentTarget, n = new URLSearchParams();
    n.set('sort_by', root.querySelector('select[name=sort_by]').value);
    root.querySelectorAll(`input[name="${AV}"]:checked`).forEach(i => n.append(AV, i.value));
    [GTE, LTE].forEach(k => { const v = root.querySelector(`input[name="${k}"]`).value; if (v !== '') n.set(k, v); });
    const s = n.toString(); router.push(base + (s ? '?' + s : ''));
  };
  const chips = [
    ...avail.map(v => ({ label: v === '1' ? 'In stock' : 'Out of stock', href: withParams(n => { n.delete(AV); avail.filter(x => x !== v).forEach(x => n.append(AV, x)); }) })),
    ...(gte !== '' || lte !== '' ? [{ label: 'Price', href: withParams(n => { n.delete(GTE); n.delete(LTE); }) }] : []),
  ];
  const clear = `${base}?sort_by=${sortBy}`;

  return (
    <>
      <section className="am-sec"><div className="am-wrap">
        <nav className="pdp-bc"><Link href="/">Home</Link> / {c.title}</nav>
        <div className="plp-hero" data-reveal>
          <CollectionImage src={c.image} alt={c.title} />
          <p className="am-eb">Collection</p><h1 className="am-h">{c.title}</h1>
          {c.description && <div className="plp-desc" dangerouslySetInnerHTML={{ __html: c.description }} />}
          <small>{total} products</small>
        </div>
        <div className="plp-form" id="am-filters" key={qs} onChange={onChange}>
          <div className="plp-bar">
            <button type="button" className="plp-fbtn" onClick={() => setOpen(o => !o)}>☰ Filters</button>
            <span className="plp-count">{total} products</span>
            <label className="plp-sort">Sort by <select name="sort_by" defaultValue={sortBy}>{sortOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></label>
          </div>
          <div className="plp-body">
            <aside className={'plp-side' + (open ? ' open' : '')}>
              <details className="plp-f" open><summary>Availability</summary>
                <ul>
                  {[['1', 'In stock', filters.availability.in], ['0', 'Out of stock', filters.availability.out]].map(([v, label, n]) => {
                    const active = avail.includes(v);
                    return <li key={v}><label><input type="checkbox" name={AV} value={v} defaultChecked={active} disabled={n === 0 && !active} /><span>{label} <em>({n})</em></span></label></li>;
                  })}
                </ul>
              </details>
              <details className="plp-f" open><summary>Price</summary>
                <div className="plp-price">
                  <label>From<input type="number" name={GTE} defaultValue={gte} min="0" max={filters.priceMax} placeholder="0" /></label>
                  <label>To<input type="number" name={LTE} defaultValue={lte} min="0" max={filters.priceMax} placeholder={String(filters.priceMax)} /></label>
                </div>
              </details>
              <Link className="plp-clear" href={clear}>Clear all filters</Link>
            </aside>
            <div className="plp-main">
              <div className="plp-chips">{chips.map(ch => <Link key={ch.label} className="plp-chip" href={ch.href}>{ch.label} ✕</Link>)}</div>
              {products.length > 0 ? (
                <>
                  <div className="am-grid">{products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}</div>
                  <Pagination page={page} pages={pages} hrefFor={hrefFor} />
                </>
              ) : <p className="plp-empty">No products match your filters. <Link href={base}>Clear filters</Link></p>}
            </div>
          </div>
        </div>
      </div></section>
      <Newsletter />
    </>
  );
}
