'use client';
import Link from 'next/link';
import { useApi, useTitle } from '../lib/hooks.js';

const collectionBottle = handle => ({
  men: '/assets/bottle-obsidian.webp',
  women: '/assets/bottle-velvet-rose.webp',
  'gift-sets': '/assets/bottle-amber-dusk.webp',
  unisex: '/assets/bottle-amber-dusk.webp',
  'for-him': '/assets/bottle-obsidian.webp',
  'for-her': '/assets/bottle-velvet-rose.webp',
  'gift-set': '/assets/bottle-amber-dusk.webp',
}[String(handle || '').toLowerCase()] || '/assets/drift-bottle.webp');

// templates/list-collections.json
export default function CollectionList() {
  useTitle('Collections');
  const { data } = useApi('/collections');
  return (
    <section className="am-sec"><div className="am-wrap">
      <div className="am-head" data-reveal><div><p className="am-eb">Explore</p><h1 className="am-h">All collections</h1></div></div>
      <div className="am-tiles">
        {(data?.collections || []).filter(c => c.handle !== 'all').map((c, i) => (
          <Link key={c.handle} className="am-tile" href={`/collections/${c.handle}`} data-reveal style={{ '--i': i, '--tb': '#1d3f8a' }}>
            {c.image ? <img src={c.image} alt={c.title} loading="lazy" /> : <div className="am-demo" style={{ '--bot': `url('${collectionBottle(c.handle)}')` }} />}
            <div className="am-tile__meta">
              <span className="am-tile__eyebrow">Collection</span>
              <h3>{c.title}</h3>
              <span className="am-tile__cta">Shop {c.title}</span>
            </div>
          </Link>
        ))}
      </div>
    </div></section>
  );
}
