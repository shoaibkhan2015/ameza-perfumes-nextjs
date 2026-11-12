import { Fragment, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BrandVideo from './BrandVideo.jsx';
import ProductCard from './ProductCard.jsx';
import { NewsletterForm } from './Footer.jsx';
import { api } from '../lib/api.js';
import { useApi } from '../lib/hooks.js';
import * as C from '../data/siteContent.js';

// Link that works for both internal routes and external URLs
export const A = ({ href, ...p }) => (href?.startsWith('/') ? <Link href={href} {...p} /> : <a href={href} {...p} />);

// ---- sections/am-trust.liquid
export function Trust() {
  return (
    <div className="am-trust"><div className="am-trust__t">
      {[1, 2].map(k => C.trust.map((b, i) => <span key={k + '-' + i}><em>{b.icon}</em>{b.text}</span>))}
    </div></div>
  );
}

const collectionBottle = handle => ({
  men: '/assets/bottle-obsidian.webp',
  women: '/assets/bottle-velvet-rose.webp',
  'gift-sets': '/assets/bottle-amber-dusk.webp',
  'for-him': '/assets/bottle-obsidian.webp',
  'for-her': '/assets/bottle-velvet-rose.webp',
  'gift-set': '/assets/bottle-amber-dusk.webp',
}[String(handle || '').toLowerCase()] || '/assets/drift-bottle.webp');

// ---- sections/am-tiles.liquid
export function Tiles() {
  const t = C.tiles;
  return (
    <section className="am-sec" id="shop"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">{t.eyebrow}</p><h2 className="am-h">{t.heading}</h2></div></div>
      <div className="am-tiles">
        {t.items.map((b, i) => {
          const tileHandle = String(b.link || '').split('/').filter(Boolean).pop() || 'all';
          const demoStyle = { '--bot': `url('${collectionBottle(tileHandle)}')` };
          return (
            <Link key={i} className="am-tile" href={b.link} data-reveal style={{ '--i': i, '--tb': b.color }}>
              {b.image ? <img src={b.image} alt="" loading="lazy" /> : <div className="am-demo" style={demoStyle} />}
              <div className="am-tile__meta">
                <span className="am-tile__eyebrow">Collection</span>
                <h3>{b.title}</h3>
                <span className="am-tile__cta">Shop {b.title}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div></section>
  );
}

// ---- sections/am-products.liquid  (collection = handle, layout = 'standard' | 'tall')
export function ProductRail({ eyebrow, heading, collection = 'all', layout = 'standard', limit = 8, bg = '#1c2a55', navigation = false }) {
  const { data } = useApi(`/products?collection=${collection}&limit=${limit}`);
  const railRef = useRef(null);
  const railId = useId();
  const [railBounds, setRailBounds] = useState({ canScroll: false, canScrollBack: false, canScrollForward: false });
  const products = data?.products || [];

  useEffect(() => {
    if (!navigation) return;
    const rail = railRef.current;
    if (!rail) return;
    const updateBounds = () => {
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      const atStart = rail.scrollLeft <= 4;
      const atEnd = maxScroll - rail.scrollLeft <= 4;
      setRailBounds({
        canScroll: maxScroll > 1,
        canScrollBack: !atStart,
        canScrollForward: !atEnd,
      });
    };
    updateBounds();
    rail.addEventListener('scroll', updateBounds, { passive: true });
    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(rail);
    return () => {
      rail.removeEventListener('scroll', updateBounds);
      resizeObserver.disconnect();
    };
  }, [navigation, products.length]);

  const scrollRail = direction => {
    const rail = railRef.current;
    const firstCard = rail?.firstElementChild;
    if (!rail || !firstCard) return;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + gap), behavior: 'smooth' });
  };
  const viewAll = <Link className="am-link" href={`/collections/${collection}`}>View all</Link>;

  return (
    <section className="am-sec"><div className="am-wrap">
      <div className="am-head" data-reveal>
        <div><p className="am-eb">{eyebrow}</p><h2 className="am-h">{heading}</h2></div>
        {navigation ? <div className="am-rail__actions">
          {railBounds.canScroll && <>
            <button type="button" className="am-rail__arrow" aria-label={`Scroll ${heading} left`} aria-controls={railId}
              disabled={!railBounds.canScrollBack} onClick={() => scrollRail(-1)}>←</button>
            <button type="button" className="am-rail__arrow" aria-label={`Scroll ${heading} right`} aria-controls={railId}
              disabled={!railBounds.canScrollForward} onClick={() => scrollRail(1)}>→</button>
          </>}
          {viewAll}
        </div> : viewAll}
      </div>
      <div className={'am-rail' + (layout === 'tall' ? ' am-rail--tall' : '')} id={navigation ? railId : undefined} ref={railRef}>
        {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} bg={bg} />)}
      </div>
    </div></section>
  );
}

// ---- sections/am-offer.liquid
export function Offer() {
  return (
    <section className="am-sec" aria-label="Discover the Améza collection">
      <div className="am-wrap am-collection-banner">
        <Image
          src="/assets/ameza-collection-banner.jpeg"
          alt="Améza Eau de Parfum — Unleash Your Signature Scent. Luxury, elegance, long lasting."
          width={1600}
          height={640}
          sizes="(max-width: 1232px) calc(100vw - 32px), 1200px"
        />
        <A className="am-collection-banner__shop" href="/collections" aria-label="Shop Améza collections">
          <span>Shop Collections <span aria-hidden="true">→</span></span>
        </A>
      </div>
    </section>
  );
}

// ---- sections/am-video.liquid
export function Video() {
  const v = C.video;
  return (
    <section className="am-sec"><div className="am-wrap">
      <div className="am-head" data-reveal style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div><p className="am-eb">{v.eyebrow}</p><h2 className="am-h">{v.heading}</h2></div>
      </div>
      <div className="vd-wrap">
        <div className="vd-side" data-reveal><b>{v.lt}</b><p>{v.ltx}</p></div>
        <div className="vd" data-reveal>
          <BrandVideo source={v.videoFile} poster={v.posterImage} caption={v.caption} />
          <span className="vd-cap">{v.caption}</span>
        </div>
        <div className="vd-side r" data-reveal><b>{v.rt}</b><p>{v.rtx}</p></div>
      </div>
    </div></section>
  );
}

// ---- sections/am-reviews.liquid
export function Reviews() {
  const r = C.reviews;
  return (
    <section className="am-sec am-rev"><div className="am-wrap">
      <div className="am-head" data-reveal>
        <div><p className="am-eb">{r.eyebrow}</p><h2 className="am-h">{r.heading}</h2></div>
        <div style={{ textAlign: 'right' }}><div className="am-sum">{r.score}</div><span className="am-stars">★★★★★</span><div style={{ fontSize: 12, opacity: 0.7 }}>{r.count} reviews</div></div>
      </div>
      <div className="am-rail">
        {r.items.map((b, i) => (
          <div key={i} className="am-rc" data-reveal style={{ '--i': i }}>
            <span className="am-stars">★★★★★</span><p>{b.text}</p><small>✔ Verified buyer</small><b>{b.name} · {b.city}</b>
          </div>
        ))}
      </div>
    </div></section>
  );
}

// ---- sections/am-faq.liquid
export function Faq() {
  const section = C.faqSection;
  return (
    <section className="am-sec"><div className="am-wrap am-faq" style={{ maxWidth: 820 }}>
      <div className="am-head" data-reveal><div><p className="am-eb">{section.eyebrow}</p><h2 className="am-h">{section.heading}</h2></div></div>
      {C.faq.map((f, i) => <details key={i} data-reveal><summary>{f.q}</summary><p>{f.a}</p></details>)}
    </div></section>
  );
}

// ---- sections/am-newsletter.liquid
export function Newsletter() {
  const n = C.newsletter;
  return (
    <section className="am-sec"><div className="am-wrap"><div className="am-nl" data-reveal>
      <p className="am-eb">{n.eyebrow}</p><h2 className="am-h">{n.heading}</h2><p>{n.text}</p>
      <NewsletterForm id="am-nl" button={n.button} />
    </div></div></section>
  );
}

// ---- sections/am-about-hero.liquid
export function AboutHero() {
  const a = C.about;
  return (
    <section className="am-sec"><div className="am-wrap"><div className="st">
      <div data-reveal>
        <p className="am-eb">{a.eyebrow}</p>
        <h1 className="am-h" style={{ fontSize: 'clamp(40px,7vw,76px)' }}>{a.heading}</h1>
        <div style={{ marginTop: 18 }}><p>{a.text.split('\n').map((l, i) => <Fragment key={i}>{i > 0 && <br />}{l}</Fragment>)}</p></div>
        <div className="st-stats">{a.stats.map(([b, s]) => <div key={s}><b>{b}</b><small>{s}</small></div>)}</div>
        <Link className="am-btn" style={{ marginTop: 26 }} href={a.ctaLink}>{a.cta}</Link>
      </div>
      <div className="st-vis" data-reveal style={{ '--i': 2 }}>
        {a.image ? <img src={a.image} alt={a.heading} loading="lazy" /> : <div className="st-bot" style={{ '--bot': "url('/assets/drift-bottle.webp')" }} />}
      </div>
    </div></div></section>
  );
}

// ---- sections/am-values.liquid
export function Values() {
  const v = C.values;
  return (
    <section className="am-sec" style={{ background: 'linear-gradient(180deg,#f6eddb,#fbf7ef)' }}><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">{v.eyebrow}</p><h2 className="am-h">{v.heading}</h2></div></div>
      <div className="vals">{v.items.map((b, i) => <div key={i} data-reveal style={{ '--i': i }}><i>{b.icon}</i><h3>{b.title}</h3><p>{b.text}</p></div>)}</div>
    </div></section>
  );
}

// ---- sections/am-contact.liquid
export function Contact() {
  const c = C.contact;
  const section = C.contactSection;
  const [s, setS] = useState({ busy: false, ok: false, err: '' });
  const submit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setS({ busy: true, ok: false, err: '' });
    try { await api('/contact', { method: 'POST', body: f }); setS({ busy: false, ok: true, err: '' }); e.target.reset(); }
    catch (er) { setS({ busy: false, ok: false, err: er.message }); }
  };
  return (
    <section className="am-sec"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">{section.eyebrow}</p><h1 className="am-h">{c.heading}</h1></div></div>
      <div className="ct">
        <div className="ct__info" data-reveal>
          {c.whatsapp && <a className="ct__c" href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener noreferrer"><i>💬</i><div><b>{section.whatsappTitle}</b><span>{c.whatsappLabel}</span></div></a>}
          <a className="ct__c" href={`mailto:${c.email}`}><i>✉️</i><div><b>{section.emailTitle}</b><span>{c.email}</span></div></a>
          <a className="ct__c" href={`tel:${c.phone}`}><i>📞</i><div><b>{section.phoneTitle}</b><span>{c.phone}</span></div></a>
          <div className="ct__c"><i>🕘</i><div><b>{section.hoursTitle}</b><span>{c.hours}</span></div></div>
        </div>
        <form className="cf" onSubmit={submit}>
          {s.ok && <p className="cf__ok">{section.successMessage}</p>}
          {s.err && <p className="am-err">{s.err}</p>}
          <label>{section.nameLabel}<input name="name" autoComplete="name" /></label>
          <label>{section.emailLabel}<input type="email" name="email" required autoComplete="email" /></label>
          <label>{section.phoneLabel}<input name="phone" autoComplete="tel" /></label>
          <label>{section.messageLabel}<textarea name="body" rows="5" required /></label>
          <button className="am-btn" type="submit" disabled={s.busy}>{section.submitLabel}</button>
        </form>
      </div>
    </div></section>
  );
}
