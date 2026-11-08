'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductRail } from '../components/sections.jsx';
import { useCart } from '../lib/cart.jsx';
import { bottleUrl, discountPct, money } from '../lib/format.js';
import { useTitle } from '../lib/hooks.js';

// templates/cart.json  (sections/am-cart.liquid)
export default function Cart() {
  useTitle('Your Shopping Cart');
  const c = useCart();
  const router = useRouter();
  useEffect(() => { c.refresh(); /* check latest prices/stock when the page opens */ }, []); // eslint-disable-line

  const th = c.freeOver;
  const pct = Math.min(100, Math.floor((c.total * 100) / th));
  return (
    <>
      <section className="am-sec"><div className="am-wrap">
        <div className="am-head" data-reveal>
          <div><p className="am-eb">Your bag</p><h1 className="am-h">Shopping cart</h1></div>
          <Link className="am-link" href="/collections/all">Continue shopping</Link>
        </div>
        {c.count > 0 ? (
          <>
            <div className="am-fs">
              <p style={{ margin: 0 }}>{c.total >= th ? <>🎉 You've unlocked <b>FREE delivery</b>!</> : <>Add <b>{money(th - c.total)}</b> more for <b>FREE delivery</b> 🚚</>}</p>
              <div className="am-bar"><u style={{ width: pct + '%' }} /></div>
            </div>
            <form className="cp" onSubmit={e => { e.preventDefault(); router.push('/checkout'); }}>
              <div className="cp__items">
                {c.lines.map(l => (
                  <div className="cp__row" key={l.variantId}>
                    {l.compareAtPrice > l.price && <span className="cp__discount-badge">{l.discountPercent > 0 ? l.discountPercent : discountPct(l.compareAtPrice, l.price)}% OFF</span>}
                    <Link className="cp__img" href={`/products/${l.handle}`}>
                      {l.image ? <img src={l.image} alt={l.title} loading="lazy" /> : <i style={{ '--bot': `url('${bottleUrl(l.handle)}')` }} />}
                    </Link>
                    <div>
                      <Link className="cp__t" href={`/products/${l.handle}`}>{l.title}</Link>
                      {!l.hasOnlyDefaultVariant && <p className="cp__v">{l.variantTitle}</p>}
                      <p className="cp__p">{money(l.price)}{l.compareAtPrice > l.price && <s>{money(l.compareAtPrice)}</s>}</p>
                    </div>
                    <div className="pdp-qty">
                      <button type="button" aria-label="Less" onClick={() => c.setQty(l.variantId, Math.max(1, l.quantity - 1))}>−</button>
                      <input type="number" value={l.quantity} min="0" aria-label="Quantity" onChange={e => c.setQty(l.variantId, Number(e.target.value) || 0)} />
                      <button type="button" aria-label="More" onClick={() => c.setQty(l.variantId, l.quantity + 1)}>+</button>
                    </div>
                    <div className="cp__tot">{money(l.price * l.quantity)}</div>
                    <button type="button" className="cp__rm" aria-label="Remove" onClick={() => c.remove(l.variantId)}>✕</button>
                  </div>
                ))}
              </div>
              <aside className="cp__sum">
                <h3>Order summary</h3>
                <label>Order note<textarea name="note" placeholder="Gift message or delivery instructions" value={c.note} onChange={e => c.setNote(e.target.value)} /></label>
                <div className="cp__line"><span>Subtotal</span><b>{money(c.total)}</b></div>
                <p className="cp__sm">Taxes and shipping calculated at checkout.</p>
                <button className="am-btn" type="submit">Checkout</button>
                <button className="cp__upd" type="button" onClick={c.refresh}>Update cart</button>
                <div className="cp__trust"><span>💵 Cash on delivery available</span><span>🔄 7-day easy returns</span><span>✅ 100% authentic</span></div>
              </aside>
            </form>
          </>
        ) : (
          <div className="cp__empty"><p>Your cart is empty.</p><Link className="am-btn" href="/collections/all">Start shopping</Link></div>
        )}
      </div></section>
      <ProductRail eyebrow="Discover more" heading="You may also like" />
    </>
  );
}
