export const SHOP_NAME = 'Améza Parfums';

export const money = n => 'Rs ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const discountPct = (compare, price) => Math.floor(((compare - price) * 100) / compare);

// Same logic as snippets/am-bottle.liquid
const BOTTLES = ['obsidian', 'velvet-rose', 'moonpetal', 'amber-dusk', 'citrus-mist', 'drift'];
export const bottleKey = handle => BOTTLES.find(k => String(handle).includes(k)) || '';
export const bottleUrl = handle => {
  const k = bottleKey(handle);
  return k === 'drift' ? '/assets/drift-bottle.webp' : k ? `/assets/bottle-${k}.webp` : '/assets/drift-bottle.webp';
};

export const fmtDate = (d, opts = { month: 'short', day: '2-digit', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('en-US', opts);
