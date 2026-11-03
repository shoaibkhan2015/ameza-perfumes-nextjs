import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useApi } from '../lib/hooks.js';
import { useCart } from '../lib/cart.jsx';
import { bottleUrl, money } from '../lib/format.js';
import { moods, moodSection } from '../data/siteContent.js';
import '../styles/mood-picker.css';

const rnd = (i, s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

function Particles({ fx }) {
  const items = useMemo(() => Array.from({ length: fx.n }, (_, i) => ({
    x: Math.round(rnd(i, 1) * 96), y: Math.round(rnd(i, 7) * 90),
    s: fx.bubble ? 10 + rnd(i, 2) * 28 : 11 + rnd(i, 2) * 17,
    d: 5 + rnd(i, 3) * 7, dl: -rnd(i, 4) * 10, dx: Math.round((rnd(i, 5) - 0.5) * 70),
    g: fx.bubble ? '' : fx.glyphs[i % fx.glyphs.length],
  })), [fx]);
  return (
    <div className="mp-fx" aria-hidden="true">
      {items.map((p, i) => (
        <span key={i} className={`mp-p ${fx.type}${fx.bubble ? ' bubble' : ''}`}
          style={{ '--x': p.x + '%', '--y': p.y + '%', '--s': p.s + 'px', '--d': p.d + 's', '--dl': p.dl + 's', '--dx': p.dx + 'px', color: fx.color }}>{p.g}</span>
      ))}
    </div>
  );
}

export default function MoodPicker() {
  const [mood, setMood] = useState(moods[0]?.key || '');
  const { data } = useApi('/products?collection=all&limit=50');
  const { add } = useCart();
  const m = moods.find(x => x.key === mood) || moods[0];
  if (!m) return null;
  const product = (data?.products || []).find(p => p.handle === m.handle) || (data?.products || []).find(p => p.handle.includes(m.handle));
  const handle = product?.handle || m.handle;
  const img = product?.featuredImage || bottleUrl(handle);
  const title = product?.title || m.handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const variant = product && (product.variants.find(v => v.id === product.selectedVariantId) || product.variants[0]);

  return (
    <section className="am-sec mp" id="mood"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">{moodSection.eyebrow}</p><h2 className="am-h">{moodSection.heading}</h2></div></div>
      <div className="mp__grid">
        <div className="mp__chips" role="group" aria-label="Choose your mood">
          {moods.map(x => (
            <button key={x.key} type="button" className={'mp__chip' + (x.key === mood ? ' on' : '')} aria-pressed={x.key === mood} onClick={() => setMood(x.key)}>
              <em>{x.icon}</em><span><b>{x.label}</b><small>{x.sub}</small></span>
            </button>
          ))}
        </div>
        <div className={`mp-stage mp-${m.key}`} style={{ '--c1': m.c1, '--c2': m.c2, '--glow': m.glow }}>
          <div className="mp-bg" key={'bg-' + m.key} />
          <Particles key={'fx-' + m.key} fx={m.fx} />
          <div className="mp-view">
            <div className="mp-halo" key={'h-' + m.key} />
            <div className="mp-scene" key={'s-' + m.key}>
              <img className="mp-bottle" src={img} alt={title} />
              <i className="mp-sheen" />
            </div>
          </div>
          <div className="mp-info" key={'i-' + m.key}>
            <p className="mp-eb">{m.icon} Your mood · {m.label}</p>
            <h3>{title}</h3>
            <p className="mp-line">{m.line}</p>
            {product && <div className="mp-price">{money(product.price)}</div>}
            <div className="mp-cta">
              {product && variant && product.available && <button type="button" className="am-btn" onClick={() => add(product, variant, 1)}>Add to cart</button>}
              <Link className="mp-ghost" href={`/products/${handle}`}>View perfume</Link>
            </div>
          </div>
        </div>
      </div>
    </div></section>
  );
}
