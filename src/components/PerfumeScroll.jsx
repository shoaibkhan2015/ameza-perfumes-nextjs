import { useEffect, useRef, useState } from 'react';
import { A } from './sections.jsx';
import '../styles/perfume-scroll.css';
import { nl2br } from '../lib/nl2br.jsx';
import { hero as H, site } from '../data/siteContent.js';
import { useReviews } from '../lib/use-reviews.js';
import { reviewStars } from '../lib/reviews.js';

const ing = key => `/assets/ing-${key}.svg`;
const bottles = [
  { name: 'Drift', image: '/assets/hero-drift.webp' },
  { name: 'Edge', image: '/assets/hero-edge.webp' },
  { name: 'Legend', image: '/assets/hero-legend.webp' },
  { name: 'Gentlemen', image: '/assets/hero-gentlemen.webp' },
];

// Port of sections/perfume-scroll.liquid (markup + its inline <script>)
export default function PerfumeScroll() {
  const reviewFeed = useReviews();
  const reviewSummary = reviewFeed.data.summary;
  const ref = useRef(null);
  const [bottleIndex, setBottleIndex] = useState(0);
  const [titleIndex, setTitleIndex] = useState(0);
  const [titleIsSwapping, setTitleIsSwapping] = useState(false);
  const [autoplayReset, setAutoplayReset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const first = ing(H.ingredients[0].key);
  const titleBottle = bottles[titleIndex];
  const shopHref = titleIndex === 0 ? H.ctaLink : H.cta2Link;

  useEffect(() => {
    if (titleIndex === bottleIndex) {
      setTitleIsSwapping(false);
      return undefined;
    }
    setTitleIsSwapping(true);
    const timer = window.setTimeout(() => {
      setTitleIndex(bottleIndex);
      setTitleIsSwapping(false);
    }, reducedMotion ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [bottleIndex, reducedMotion, titleIndex]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setBottleIndex(index => (index + 1) % bottles.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [autoplayReset, reducedMotion]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const q = s => root.querySelector(s);
    const cyl = q('[data-cyl]'), cards = [].slice.call(root.querySelectorAll('.ps__card')),
      info = q('.ps__info'), grp = q('.ps__group'), nameEl = q('.ps__name'), noteEl = q('.ps__note'),
      hero = q('.ps__hero'), heroImg = hero.querySelector('img'), fx = [].slice.call(root.querySelectorAll('.ps__fx img')),
      n = cards.length, step = 360 / Math.max(n, 1), pad = x => (x < 10 ? '0' : '') + x;
    if (!n) return undefined;
    let last = -1, rotation = 0, swapTimer = null, noteTimer = null;

    const P = [[8, 18, 54, 9, -1], [84, 10, 44, 7.5, 1], [16, 56, 36, 8.5, 1], [90, 52, 60, 10, -1], [4, 36, 30, 6.5, 1], [78, 30, 32, 7, -1], [26, 6, 38, 9, 1], [68, 60, 28, 8, -1]];
    fx.forEach((e, i) => {
      const p = P[i % P.length];
      e.style.cssText = 'left:' + p[0] + '%;top:' + p[1] + '%;width:' + p[2] + 'px;--d:' + p[3] + 's;--dl:-' + i * 1.1 + 's;--dx:' + (p[4] * 14) + 'px;--dy:' + (-18 - i * 3) + 'px;--r:' + (p[4] * 40) + 'deg;--o:' + (i % 3 ? '.55' : '.85') + ';' + (i % 3 ? 'filter:blur(1.5px)' : '');
    });
    function layout() {
      const w = cards[0].offsetWidth, r = Math.round((w / 2 + 8) / Math.tan(Math.PI / Math.max(n, 3)));
      cards.forEach((c, i) => { c.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + r + 'px)'; });
    }
    function setActive(i) {
      if (i === last) return; last = i;
      const c = cards[i], src = c.dataset.img;
      info.classList.add('is-swap'); hero.classList.add('is-out'); fx.forEach(e => e.classList.remove('on'));
      if (swapTimer) window.clearTimeout(swapTimer);
      const updateContent = () => {
        grp.textContent = (c.dataset.group || '') + '  ·  ' + pad(i + 1) + ' / ' + pad(n); nameEl.textContent = c.dataset.name; noteEl.textContent = c.dataset.note;
        heroImg.src = src; hero.classList.toggle('r', i % 2 === 1); hero.style.setProperty('--hx', i % 2 ? '120%' : '-120%');
        hero.style.setProperty('--hr', (i % 2 ? 12 : -12) + 'deg');
        fx.forEach(e => { e.src = src; e.classList.add('on'); });
        info.classList.remove('is-swap'); hero.classList.remove('is-out');
        swapTimer = null;
      };
      if (reducedMotion) updateContent();
      else swapTimer = window.setTimeout(updateContent, 260);
      cards.forEach((k, j) => k.classList.toggle('is-active', j === i));
      root.style.setProperty('--ps-bg', c.dataset.color || '#1d5f9a');
    }
    function go(nextRotation) {
      rotation = nextRotation;
      const i = ((rotation % n) + n) % n;
      cyl.style.transform = 'rotateX(-10deg) rotateY(' + (-rotation * step) + 'deg)';
      root.style.setProperty('--p', (i + 1) / n);
      root.style.setProperty('--sw', '100%');
      setActive(i);
    }
    function restartNotes() {
      if (noteTimer) window.clearInterval(noteTimer);
      if (!reducedMotion) noteTimer = window.setInterval(() => go(rotation + 1), 3200);
    }
    const onResize = () => layout();
    const onMove = e => { const r = root.getBoundingClientRect(); root.style.setProperty('--mx', ((e.clientX / r.width) - 0.5) * 2); root.style.setProperty('--my', ((e.clientY / innerHeight) - 0.5) * 2); };
    layout(); go(0); restartNotes();
    window.addEventListener('resize', onResize);
    if (!reducedMotion) root.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('resize', onResize);
      root.removeEventListener('pointermove', onMove);
      if (noteTimer) window.clearInterval(noteTimer);
      if (swapTimer) window.clearTimeout(swapTimer);
    };
  }, [reducedMotion]);

  const selectBottle = index => {
    setBottleIndex(index);
    setAutoplayReset(value => value + 1);
  };

  return (
    <section ref={ref} className={`ps hz${reducedMotion ? ' ps--reduced-motion' : ''}`} data-ps id="ps-hero" style={{ '--ps-h': H.stageH }}>
      <div className="ps__sticky">
        <div className="ps__bg" style={H.backgroundImage ? { backgroundImage: `linear-gradient(rgba(251,247,239,.22),rgba(251,247,239,.22)),url("${H.backgroundImage}")` } : undefined} />
        <div className="ps__side l">{H.sideL}</div><div className="ps__side r">{H.sideR}</div>
        <div className="ps__word l">{nl2br(H.wordL)}</div><div className="ps__word r">{nl2br(H.wordR)}</div>
        <div className="ps__head">
          <div className="ps__brand"><span className="ps__emb"><img className="am-logo-image" src={site.logoImage || '/assets/ameza-logo-black.jpeg'} alt={site.logoImage ? `${site.brand} logo` : ''} /></span><span className="ps__bn"><b>{H.brand}</b><small>{H.brandSub}</small></span></div>
          <p className="ps__tag">{H.tag}</p>
          <h1 className="ps__h1">AMÉZA Perfumes Pakistan<span>Most Luxurious Perfume · Order Now</span></h1>
          <h2 className={`ps__title${titleIsSwapping ? ' sw' : ''}`}>{titleBottle.name}</h2>
          <div className="ps__names" role="group" aria-label="Choose a fragrance">
            {bottles.map((bottle, index) => (
              <button key={bottle.name} type="button" className={index === bottleIndex ? 'on' : ''} aria-pressed={index === bottleIndex} onClick={() => selectBottle(index)}>
                {bottle.name}
              </button>
            ))}
          </div>
        </div>
        <p className="ps__lead">{H.lead}</p>
        <div className="ps__prog"><small>Explore the fragrance notes</small><i><u /></i></div>
        <div className="ps__scene">
          <div className="ps__glow" />
          <div className="ps__fx">{Array.from({ length: 8 }, (_, i) => <img key={i} alt="" src={first} />)}</div>
          <div className="ps__hero"><img alt="" src={first} /></div>
          <div className="ps__slides">
            {bottles.map((bottle, index) => (
              <img key={bottle.name} className={index === bottleIndex ? 'on' : ''} src={bottle.image} alt={index === bottleIndex ? `${bottle.name} by Améza` : ''} aria-hidden={index !== bottleIndex} />
            ))}
          </div>
          <div className="ps__dots" role="group" aria-label="Choose a bottle">
            {bottles.map((bottle, index) => (
              <button key={bottle.name} type="button" className={index === bottleIndex ? 'on' : ''} aria-label={`Show ${bottle.name}`} aria-pressed={index === bottleIndex} onClick={() => selectBottle(index)} />
            ))}
          </div>
          <div className="ps__cyl" data-cyl>
            {H.ingredients.map(b => (
              <div key={b.key} className="ps__card" data-img={ing(b.key)} data-group={b.group} data-name={b.name} data-note={b.note} data-color={b.color} style={{ '--c': b.color }}>
                <img src={ing(b.key)} alt={b.name} loading="lazy" />
              </div>
            ))}
          </div>
        </div>
        <div className="ps__info"><p className="ps__group" /><h3 className="ps__name" /><p className="ps__note" /></div>
        <div className="ps__cta"><A href={shopHref}>Shop {titleBottle.name}</A><A className="ps__ghost" href={H.cta2Link}>{H.cta2}</A></div>
        <div className="ps__meta"><span className="am-stars">{reviewStars(reviewSummary.average)}</span><b>{reviewFeed.loading || reviewFeed.error || !reviewSummary.count ? '—' : Number(reviewSummary.average).toFixed(1)}</b><span>{reviewFeed.loading ? 'Loading reviews…' : reviewFeed.error ? 'Reviews unavailable' : `${reviewSummary.count} customer reviews`}</span></div>
      </div>
    </section>
  );
}
