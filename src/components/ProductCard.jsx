import Link from 'next/link';
import { useCart } from '../lib/cart.jsx';
import { bottleUrl, discountPct, money } from '../lib/format.js';

// Port of snippets/am-product-card.liquid (also the markup used by the homepage product rails)
export default function ProductCard({ product, index = 0, bg = '#1c2a55' }) {
  const { add } = useCart();
  const v = product.variants.find(x => x.id === product.selectedVariantId) || product.variants[0];
  const onSale = product.compareAtPrice > product.price;
  const salePercent = product.discountPercent > 0 ? product.discountPercent : discountPct(product.compareAtPrice, product.price);
  const inv = product.inventory;
  const submit = e => { e.preventDefault(); if (product.available) add(product, v, 1); };
  return (
    <article className="am-card" data-reveal style={{ '--i': index, '--bg': bg }}>
      <Link className="am-card__img" href={`/products/${product.handle}`}>
        {onSale && <span className="am-badge">{salePercent}% OFF</span>}
        {product.featuredImage
          ? <img src={product.featuredImage} alt={product.title} loading="lazy" />
          : <div className="am-demo" role="img" aria-label={product.title} style={{ '--bot': `url('${bottleUrl(product.handle)}')` }} />}
      </Link>
      <div className="am-card__body">
        <span className="am-stars">★★★★★ 4.9</span>
        <h3 className="am-card__t"><Link href={`/products/${product.handle}`}>{product.title}</Link></h3>
        <div className="am-price">{onSale && <s className="am-was">{money(product.compareAtPrice)}</s>}{money(product.price)}</div>
        {product.available && inv > 0 && inv < 10 && <p className="am-low">🔥 Only {inv} left in stock</p>}
        <form onSubmit={submit}>
          <button className="am-btn am-add" disabled={!product.available}>{product.available ? 'Add to cart' : 'Sold out'}</button>
        </form>
      </div>
    </article>
  );
}
