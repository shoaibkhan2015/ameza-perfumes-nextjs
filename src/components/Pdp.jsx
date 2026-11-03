import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Countdown from './Countdown.jsx';
import { useCart } from '../lib/cart.jsx';
import { bottleKey, bottleUrl, discountPct, money } from '../lib/format.js';
import { getProductNoteRows } from '../lib/fragrance.js';
import * as C from '../data/siteContent.js';

// Port of snippets/am-note-row.liquid
const NoteRow = ({ name, k, i }) => (
  <div className="sp-r" style={{ '--i': i }}>
    <span className="sp-ic"><img src={`/assets/ing-${k}.svg`} alt="" width="46" height="46" loading="lazy" /></span>
    <div className="sp-b"><div className="sp-bl sp-note-name"><span>{name}</span></div></div>
  </div>
);
const Bar = ({ label, v }) => (
  <div className="sp-b"><div className="sp-bl"><span>{label}</span><b><i data-pct={v}>0</i>%</b></div><div className="sp-tr"><i className="sp-f" style={{ '--w': v + '%' }} /></div></div>
);

const GROUPS = [['Top Notes', 'Opening · first 15 min'], ['Middle Notes', 'Heart · 2–4 hours'], ['Base Notes', 'Dry-down · 6+ hours']];
const eta = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };

// Port of sections/am-pdp-main.liquid
export function PdpMain({ product }) {
  const { add } = useCart();
  const router = useRouter();
  const profile = C.profileFor(product.handle);
  const fragrance = product.fragrance || {};
  const profilePerf = Array.isArray(fragrance.perf) ? fragrance.perf : profile?.perf || [C.pdp.longevity, C.pdp.projection, C.pdp.freshness];
  const [lon, prj, fre] = profilePerf;
  const rows = getProductNoteRows(fragrance, profile, product.handle === 'drift' ? C.pdp.notes : []);

  const [vid, setVid] = useState(product.selectedVariantId);
  useEffect(() => setVid(product.selectedVariantId), [product.id, product.selectedVariantId]);
  const v = product.variants.find(x => x.id === vid) || product.variants[0];
  const [qty, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const imgs = product.images;

  const ctaRef = useRef(null), barRef = useRef(null);
  useEffect(() => {      // sticky "add to cart" bar appears when the main button scrolls off the top
    const c = ctaRef.current, b = barRef.current; if (!c || !b) return;
    const io = new IntersectionObserver(es => {
      const r = es[0].boundingClientRect, on = !es[0].isIntersecting && r.top < 0;
      b.classList.toggle('on', on);
      document.documentElement.style.setProperty('--sb', on ? '66px' : '0px');
    });
    io.observe(c);
    return () => { io.disconnect(); document.documentElement.style.setProperty('--sb', '0px'); };
  }, [product.id]);

  const submit = e => { e?.preventDefault(); if (v.available) add(product, v, qty); };
  const buyNow = () => { if (v.available) { add(product, v, qty, { silent: true }); router.push('/checkout'); } };
  const onSale = v.compareAtPrice > v.price;

  return (
    <>
      <section className="am-sec" style={{ paddingTop: 'clamp(24px,4vw,48px)' }}><div className="am-wrap">
        <nav className="pdp-bc"><Link href="/">Home</Link> / <Link href="/collections/all">Shop</Link> / {product.title}</nav>
        <div className="pdp">
          <div className="pdp-gal" data-reveal>
            <div className="pdp-main" onPointerMove={e => { const m = e.currentTarget, r = m.getBoundingClientRect(); m.style.setProperty('--zx', ((e.clientX - r.left) / r.width) * 100 + '%'); m.style.setProperty('--zy', ((e.clientY - r.top) / r.height) * 100 + '%'); }}>
              {imgs.length
                ? imgs.map((u, i) => <div key={i} className={'pdp-slide' + (i === slide ? ' on' : '')}><img src={u} alt={product.title} /></div>)
                : <div className="pdp-slide on"><div className="pdp-demo" style={{ '--bot': `url('${bottleUrl(product.handle)}')` }} /></div>}
            </div>
            <div className="pdp-thumbs">
              {imgs.map((u, i) => <button key={i} type="button" className={'pdp-th' + (i === slide ? ' on' : '')} aria-label={`Image ${i + 1}`} onClick={() => setSlide(i)}><img src={u} alt="" loading="lazy" /></button>)}
            </div>
          </div>
          <div className="pdp-info" data-reveal style={{ '--i': 2 }}>
            <p className="pdp-eb">{product.vendor}{product.productType && ` · ${product.productType}`}</p>
            <h1 className="pdp-title">{product.title}</h1>
            <a className="pdp-rate" href="#reviews"><span className="am-stars">★★★★★</span> {C.pdp.score} · {C.pdp.count} reviews</a>
            <div className="pdp-price">
              <span>{money(v.price)}</span>
              {onSale && <><s className="am-was">{money(v.compareAtPrice)}</s><span className="pdp-save">Save {discountPct(v.compareAtPrice, v.price)}%</span></>}
            </div>
            <div className="pdp-desc" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />

            <div className="sp" data-reveal>
              <p className="sp-t">Scent profile</p>
              <div className="sp-perf"><Bar label="Longevity" v={lon} /><Bar label="Projection" v={prj} /><Bar label="Freshness" v={fre} /></div>
              {GROUPS.map(([g, sub]) => (
                <div className="sp-g" key={g}>
                  <div className="sp-gh"><b>{g}</b><small>{sub}</small></div>
                  {rows.map((r, i) => r.group === g && <NoteRow key={i} name={r.name} k={r.key} i={i} />)}
                </div>
              ))}
            </div>

            <form onSubmit={submit}>
              {!product.hasOnlyDefaultVariant && (
                <>
                  <p className="pdp-opt">{product.optionName}</p>
                  <div className="pdp-pills">
                    {product.variants.map(x => (
                      <label className="pdp-pill" key={x.id}>
                        <input type="radio" name="id" value={x.id} checked={x.id === v.id} disabled={!x.available} onChange={() => setVid(x.id)} />
                        <span>{x.title}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              {v.available && v.inventory > 0 && v.inventory < 10 && <p className="pdp-urg">🔥 Only {v.inventory} left — selling fast</p>}
              <div className="pdp-cta" ref={ctaRef}>
                <div className="pdp-qty">
                  <button type="button" aria-label="Less" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                  <input name="quantity" value={qty} readOnly />
                  <button type="button" aria-label="More" onClick={() => setQty(q => Math.max(1, q + 1))}>+</button>
                </div>
                <button className="am-btn pdp-atc" disabled={!v.available}>{v.available ? 'Add to cart' : 'Sold out'}</button>
              </div>
              <div className="pdp-buy"><button type="button" className="am-buynow" disabled={!v.available} onClick={buyNow}>Buy it now</button></div>
            </form>

            <p className="pdp-dispatch">⏱ Order within <Countdown end="" /> for same-day dispatch</p>
            <div className="pdp-ship">🚚 Estimated delivery: <b>{eta(2)} – {eta(4)}</b></div>
            <div className="pdp-perks"><span>💵 Cash on delivery</span><span>🔄 7-day returns</span><span>✅ 100% authentic</span><span>🎁 Free gift wrap</span></div>
            <div className="pdp-acc">
              <details><summary>How to use</summary><p>{C.pdp.howto}</p></details>
              <details><summary>Shipping &amp; returns</summary><p>{C.pdp.shipping}</p></details>
            </div>
          </div>
        </div>
      </div></section>
      <div className="pdp-bar" ref={barRef}>
        <div>{product.title} · <span>{money(v.price)}</span></div>
        <button type="button" className="am-btn" onClick={submit}>Add to cart</button>
      </div>
    </>
  );
}

// Port of sections/am-pdp-story.liquid
export function PdpStory({ product }) {
  const s = C.pdpStory;
  const story = product.fragrance?.story || {};
  const heading = String(story.heading || '').trim() || product.title;
  const fallbackDescription = String(product.descriptionHtml || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const description = String(story.description || '').trim() || fallbackDescription || product.title;
  const paragraphs = description.split(/\|\||\r?\n\s*\r?\n/).map(text => text.trim()).filter(Boolean);
  const fallbackImage = Array.isArray(product.images)
    ? product.images.find(image => typeof image === 'string' && image.trim())?.trim() || ''
    : '';
  const initialImage = String(story.image || '').trim() || fallbackImage;
  const [storyImage, setStoryImage] = useState(initialImage);
  useEffect(() => setStoryImage(initialImage), [product.id, initialImage]);
  const productBottleKey = bottleKey(product.handle);
  const bottleImage = !storyImage && productBottleKey === product.handle ? bottleUrl(product.handle) : '';
  const stats = Array.isArray(story.stats)
    ? story.stats.filter(stat => Array.isArray(stat) && String(stat[0] || '').trim() && String(stat[1] || '').trim())
    : s.stats;
  return (
    <section className="am-sec"><div className="am-wrap"><div className="st" style={!storyImage && !bottleImage ? { gridTemplateColumns: '1fr' } : undefined}>
      {(storyImage || bottleImage) && <div className="st-vis" data-reveal>
        {storyImage
          ? <img src={storyImage} alt={`${product.title} story`} loading="lazy" onError={() => setStoryImage(current => current === fallbackImage ? '' : fallbackImage)} />
          : <div className="st-bot" style={{ '--bot': `url('${bottleImage}')` }} />}
      </div>}
      <div data-reveal style={{ '--i': 2 }}>
        <p className="am-eb">{String(story.eyebrow || '').trim() || s.eyebrow}</p><h2 className="am-h">{heading}</h2>
        <div className="st" style={{ display: 'block', marginTop: 18 }}><p>{paragraphs.map((text, i) => <Fragment key={i}>{i > 0 && <><br /><br /></>}{text}</Fragment>)}</p></div>
        {String(story.quote || '').trim() && <blockquote>{String(story.quote).trim()}</blockquote>}
        {stats.length > 0 && <div className="st-stats">{stats.map(([value, label], i) => <div key={`${label}-${i}`}><b>{value}</b><small>{label}</small></div>)}</div>}
      </div>
    </div></div></section>
  );
}

// Port of sections/am-pdp-reviews.liquid
export function PdpReviews() {
  const r = C.pdpReviews;
  return (
    <section className="am-sec am-rev" id="reviews"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">{r.eyebrow}</p><h2 className="am-h">{r.heading}</h2></div></div>
      <div className="rv">
        <div className="rv-sum" data-reveal>
          <div className="am-sum">{r.score}</div><span className="am-stars">★★★★★</span>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Based on {r.count} reviews</div>
          {[5, 4, 3, 2, 1].map(n => <div className="rb" key={n}>{n}★<i><u style={{ '--w': r['p' + n] + '%' }} /></i><span>{r['p' + n]}%</span></div>)}
          <a className="am-btn" style={{ width: '100%', marginTop: 14 }} href="#">{r.writeReviewLabel}</a>
        </div>
        <div className="rv-list">
          {r.items.map((b, i) => (
            <div key={i} className="am-rc" data-reveal style={{ '--i': i }}>
              <time>{b.date}</time><span className="am-stars">★★★★★</span><h4>{b.title}</h4><p>{b.text}</p><small>✔ Verified buyer</small><b>{b.name} · {b.city}</b>
            </div>
          ))}
        </div>
      </div>
    </div></section>
  );
}
