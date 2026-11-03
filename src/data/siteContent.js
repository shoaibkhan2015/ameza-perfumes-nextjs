// All the text/settings that used to live in Shopify's theme editor
// (templates/*.json + the defaults in each section's {% schema %}).
// Edit here to change copy on the site.

export const FREE_DELIVERY_OVER = 5000; // Rs — the server uses FREE_SHIPPING_OVER from .env

function normalizeWhatsappNumber(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits;
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) return `92${digits}`;
  return digits;
}

const STORAGE_KEY = 'ameza-site-content-v1';
let activeContent = null;

function readLegacyContent() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getOverrideValue(scope, key) {
  const stored = activeContent === null ? readLegacyContent() : activeContent;
  if (!stored || typeof stored !== 'object') return undefined;
  const value = scope === 'root' ? stored[key] : stored[scope]?.[key];
  return value === undefined ? undefined : value;
}

function mergeContent(base, override) {
  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base.map(item => mergeContent(item, undefined));
  }
  if (base && typeof base === 'object') {
    const values = override && typeof override === 'object' && !Array.isArray(override) ? override : {};
    return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(values)])]
      .map(key => [key, key in values ? mergeContent(base[key], values[key]) : mergeContent(base[key], undefined)]));
  }
  return override === undefined ? base : override;
}

function createEditableProxy(target, scope) {
  return new Proxy(target, {
    get(currentTarget, prop) {
      if (prop === Symbol.toStringTag) return currentTarget.constructor?.name || 'Object';
      if (prop in currentTarget) {
        const value = getOverrideValue(scope, prop);
        if (value !== undefined) return value;
        const targetValue = currentTarget[prop];
        return typeof targetValue === 'object' && targetValue !== null ? createEditableProxy(targetValue, scope) : targetValue;
      }
      return undefined;
    },
  });
}

export function setSiteContentOverrides(content) {
  if (content !== null && (typeof content !== 'object' || Array.isArray(content))) {
    throw new TypeError('Website content must be a JSON object.');
  }
  activeContent = content;
}

export function getSiteContentSnapshot(content = activeContent === null ? readLegacyContent() : activeContent) {
  const stored = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  return mergeContent(baseContent, stored);
}

export function applySiteAppearance(value = appearance) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const tokens = {
    '--ink': value.ink,
    '--ivory': value.ivory,
    '--g1': value.goldLight,
    '--g2': value.gold,
    '--g3': value.goldDark,
    '--navy': value.navy,
    '--navy2': value.navyLight,
    '--am-button-radius': `${value.buttonRadius}px`,
    '--am-content-width': `${value.contentWidth}px`,
  };
  Object.entries(tokens).forEach(([name, token]) => root.style.setProperty(name, token));
}

export const whatsappNumber = normalizeWhatsappNumber(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

const baseContent = {
  site: {
    brand: 'AMÉZA',
    tagline: 'Parfums',
    logoImage: '',
    whatsapp: whatsappNumber,
    phone: '+92 300 0000000',
    email: 'hello@ameza.pk',
    address: 'Pakistan',
  },
  announcement: { visible: true, text: '10.10 Sale', end: '', endText: 'Is Live Now!' },
  layoutSettings: { headerVisible: true, footerVisible: true, whatsappVisible: true },
  mainMenu: [
    { title: 'Home', url: '/' },
    { title: 'Shop', url: '/collections/all', children: [
      { title: 'For Him', url: '/collections/men' },
      { title: 'For Her', url: '/collections/women' },
      { title: 'Unisex', url: '/collections/unisex' },
    ] },
    { title: 'About', url: '/pages/about' },
    { title: 'Contact', url: '/pages/contact' },
  ],
  footerMenu: [
    { title: 'Search', url: '/search' },
    { title: 'Shipping policy', url: '/pages/shipping-policy' },
    { title: 'Refund policy', url: '/pages/refund-policy' },
    { title: 'Privacy policy', url: '/pages/privacy-policy' },
    { title: 'Terms of service', url: '/pages/terms-of-service' },
  ],
  footer: {
    about: 'Long-lasting eau de parfum, blended for our climate and made to be remembered. Crafted in small batches in Pakistan.',
    title1: 'Shop', title2: 'Help',
    newsletterHeading: 'Stay in the loop',
    nlText: 'Get 10% off your first order and early access to new drops.',
    social: [
      { platform: 'instagram', url: 'https://instagram.com/' },
      { platform: 'facebook', url: 'https://facebook.com/' },
      { platform: 'tiktok', url: 'https://tiktok.com/' },
      { platform: 'youtube', url: 'https://youtube.com/' },
      { platform: 'whatsapp', url: whatsappNumber ? `https://wa.me/${whatsappNumber}` : '' },
    ],
  },
  extras: {
    sticky: false, stickyText: 'Drift — Rs 2,490 only', stickyButton: 'Buy now', stickyLink: '/products/drift',
    proofList: 'Ali|Karachi|Drift;Sara|Lahore|Velvet Rose;Bilal|Islamabad|Ember Oud;Hira|Rawalpindi|Aqua Veil;Zain|Peshawar|Drift',
  },
  hero: {
    tag: 'AMÉZA · Eau de Parfum · For Men', heading: 'Drift', cta: 'Shop Drift', ctaLink: '/products/drift',
    bottleImage: '', backgroundImage: '',
    len: 900, stageH: 84, topOff: 84,
    sideL: 'AMÉZA · EST. 2026 · FRAGRANCE HOUSE', sideR: 'CRAFTED IN PAKISTAN · EAU DE PARFUM',
    wordL: 'Fresh.\nAquatic.\nWoody.', wordR: 'Bold.\nCalm.\nTimeless.',
    brand: 'AMÉZA', brandSub: 'Parfums · Est. 2026',
    lead: 'Long-lasting eau de parfum, blended for our climate. Scroll to discover the ten notes inside every bottle.',
    cta2: 'View all fragrances', cta2Link: '#shop', rating: '4.9', ratingText: '· 2,300+ happy customers',
    bottleAspect: 0.549,
    ingredients: [
      { name: 'Grapefruit', key: 'grapefruit', color: '#b8472f', group: 'Top Notes', note: 'Bright, zesty grapefruit opens Drift with a juicy sparkle.' },
      { name: 'Lemon', key: 'lemon', color: '#a38a12', group: 'Top Notes', note: 'Sharp sun-ripened lemon adds a clean, energising lift.' },
      { name: 'Mint', key: 'mint', color: '#1f7a58', group: 'Top Notes', note: 'Cool fresh mint for an icy, invigorating first impression.' },
      { name: 'Marine Accord', key: 'marine', color: '#1d5f9a', group: 'Middle Notes', note: 'Salty sea breeze and ocean air at the heart of the scent.' },
      { name: 'Lavender', key: 'lavender', color: '#5b4a9e', group: 'Middle Notes', note: 'Calming aromatic lavender that smooths the heart notes.' },
      { name: 'Ginger', key: 'ginger', color: '#9a5a22', group: 'Middle Notes', note: 'Warm spicy ginger adds a subtle, lively kick.' },
      { name: 'Guaiac Wood', key: 'guaiac', color: '#6b4630', group: 'Base Notes', note: 'Smoky, creamy guaiac wood gives depth and character.' },
      { name: 'Cedarwood', key: 'cedar', color: '#3d5a34', group: 'Base Notes', note: 'Dry, elegant cedarwood anchors the fragrance.' },
      { name: 'Musk', key: 'musk', color: '#7c6a8e', group: 'Base Notes', note: 'Soft clean musk leaves a skin-like, lasting trail.' },
      { name: 'Amber', key: 'amber', color: '#b0701c', group: 'Base Notes', note: 'Golden amber seals everything with warm, lasting richness.' },
    ],
  },
  tiles: {
    eyebrow: 'Explore', heading: 'Find your signature',
    items: [
      { title: 'For Him', color: '#1d3f8a', link: '/collections/men', image: '' },
      { title: 'For Her', color: '#8e2a58', link: '/collections/women', image: '' },
      { title: 'Unisex', color: '#9a6a1c', link: '/collections/unisex', image: '' },
    ],
  },
  offer: {
    eyebrow: 'Limited time', heading: 'Buy 2, save 15% — today only',
    text: 'Apna jodi perfume chunein. Code checkout par lagayein aur 15% off payen. Free delivery Rs 5,000 se upar.',
    code: 'AMEZA15', end: '', button: 'Claim the offer', link: '/collections/all', image: '',
  },
  reviews: {
    eyebrow: 'Loved across Pakistan', heading: 'Real people. Real compliments.',
    score: '4.9', count: '2,300+',
    items: [
      { name: 'Ahmed R.', city: 'Lahore', text: 'Drift ki projection kamaal hai — office mein 3 logon ne poocha konsa perfume hai!' },
      { name: 'Sana K.', city: 'Karachi', text: 'Packaging bilkul luxury brand jaisi. Fragrance 9-10 ghante chali, 100% recommend.' },
      { name: 'Hamza S.', city: 'Islamabad', text: 'Delivery 2 din mein aa gayi aur bottle bilkul original. Gift ke liye perfect.' },
      { name: 'Maryam A.', city: 'Faisalabad', text: 'Velvet Rose ne to dil jeet liya. Price ke hisaab se best quality.' },
      { name: 'Usman T.', city: 'Multan', text: 'Pehli baar online perfume mangwaya, COD ki wajah se bharosa hua. Ab repeat customer hoon.' },
    ],
  },
  faq: [
    { q: 'Kya perfumes original aur long-lasting hain?', a: 'Ji haan. Har bottle 100% authentic hai aur Eau de Parfum concentration ki wajah se 8-10 ghante tak chalti hai.' },
    { q: 'Delivery mein kitna time lagta hai?', a: 'Major cities mein 2-3 din, baaqi Pakistan mein 3-5 din. Rs 5,000 se upar order par delivery free hai.' },
    { q: 'Cash on delivery available hai?', a: 'Bilkul. Aap parcel dekh kar payment kar sakte hain.' },
    { q: 'Agar pasand na aaye to?', a: '7 din ke andar easy return/exchange. Bas humein WhatsApp karein.' },
  ],
  newsletter: {
    eyebrow: 'Members only', heading: 'Get 10% off your first order',
    text: 'Join the Améza circle for early access to drops and private offers.', button: 'Get my code',
  },
  video: {
    eyebrow: 'AMÉZA · Brand film', heading: 'Experience Drift', caption: 'Drift by Améza',
    videoUrl: '', videoFile: '', posterImage: '',
    lt: 'Crafted with care', ltx: 'Small batches, deep sapphire glass and gold detailing — every bottle is finished by hand.',
    rt: 'Made to be remembered', rtx: 'Eight to ten hours of calm, confident freshness from the first spray to the last.',
  },
  about: {
    eyebrow: 'About us', heading: 'The house of Améza',
    text: "Améza began with a simple idea: premium fragrance that suits our climate, our culture and our budget.\nEvery blend is created in small batches, tested on real skin through real summers, and bottled in deep sapphire glass with gold detailing.\nNo shortcuts, no dilution — just scent worth remembering.",
    stats: [['2026', 'Founded'], ['8–10h', 'Longevity'], ['100%', 'Authentic']],
    cta: 'Shop the collection', ctaLink: '/collections/all', image: '',
  },
  values: {
    eyebrow: 'Our promise', heading: 'What we stand for',
    items: [
      { icon: '🧪', title: 'Small-batch crafted', text: 'Every batch is blended, rested and quality-checked by hand before it is bottled.' },
      { icon: '🌿', title: 'Honest ingredients', text: 'Quality oils and aroma materials. No fillers, no shortcuts.' },
      { icon: '☀️', title: 'Made for our climate', text: 'Tested through hot summers so your fragrance lasts when it matters.' },
      { icon: '✅', title: '100% authentic', text: 'Direct from our house to you, with easy 7-day returns.' },
    ],
  },
  contact: {
    heading: "We'd love to hear from you", whatsapp: whatsappNumber, whatsappLabel: 'Chat with us',
    email: 'hello@ameza.pk', phone: '+923000000000', hours: 'Mon–Sat, 10am – 8pm',
  },
  pdp: {
    score: '4.9', count: '126', longevity: 90, projection: 80, freshness: 88,
    howto: 'Spray 2-3 times on pulse points — neck, wrists and behind the ears — from 15 cm away. Do not rub. For longer wear, apply on moisturised skin.',
    shipping: 'Free delivery on orders above Rs 5,000. Standard delivery 2-4 working days. Cash on delivery available. Easy 7-day return or exchange on unopened items.',
    notes: [
      { name: 'Grapefruit', key: 'grapefruit', group: 'Top Notes', pct: 85 },
      { name: 'Lemon', key: 'lemon', group: 'Top Notes', pct: 70 },
      { name: 'Marine Accord', key: 'marine', group: 'Middle Notes', pct: 90 },
      { name: 'Lavender', key: 'lavender', group: 'Middle Notes', pct: 65 },
      { name: 'Cedarwood', key: 'cedar', group: 'Base Notes', pct: 70 },
      { name: 'Amber', key: 'amber', group: 'Base Notes', pct: 75 },
    ],
  },
  pdpStory: {
    eyebrow: 'Our story',
    stats: [['8–10h', 'Longevity'], ['50 ml', 'Eau de Parfum'], ['Small', 'Batch crafted']],
  },
  pdpReviews: {
    eyebrow: 'Customer reviews', heading: 'What buyers say about this fragrance', writeReviewLabel: 'Write a review',
    score: '4.9', count: '126', p5: 86, p4: 10, p3: 3, p2: 1, p1: 0,
    items: [
      { name: 'Ahmed R.', city: 'Lahore', title: 'Unreal projection', date: '12 Oct 2026', text: 'Drift ki projection kamaal hai — office mein 3 logon ne poocha konsa perfume hai!' },
      { name: 'Sana K.', city: 'Karachi', title: 'Clean luxury feel', date: '18 Oct 2026', text: 'Packaging bilkul premium jaisi. Fragrance soft but long-lasting. Highly recommend.' },
      { name: 'Bilal H.', city: 'Islamabad', title: 'Daily wear friendly', date: '04 Nov 2026', text: 'Office and dinner ke darmiyan perfect. Light enough for daytime, strong enough for evenings.' },
    ],
  },
  trust: [
    { icon: '🚚', text: 'Free delivery over Rs 5,000' }, { icon: '💵', text: 'Cash on delivery' },
    { icon: '🔄', text: '7-day easy returns' }, { icon: '✅', text: '100% authentic' },
    { icon: '⚡', text: 'Ships in 24 hours' }, { icon: '🎁', text: 'Free gift wrap' },
  ],
  moods: [
    { key: 'formal', icon: '💼', label: 'Formal', sub: 'Office · Meetings · Interviews', handle: 'obsidian', c1: '#222c55', c2: '#05070f', glow: '#d9a93f', line: 'Quiet confidence. Sharp, polished and made to be remembered.', fx: { type: 'up', glyphs: ['✦', '·', '✧'], color: '#f6dc8e', n: 14 } },
    { key: 'party', icon: '🎉', label: 'Party', sub: 'Night out · Club · Celebration', handle: 'drift', c1: '#6a1f9e', c2: '#12051f', glow: '#ff4fd8', line: 'Turn the volume up. Bold, loud and impossible to ignore.', fx: { type: 'down', glyphs: ['🎉', '✨', '🎊', '★', '●'], color: '#ffd35a', n: 26 } },
    { key: 'romantic', icon: '❤️', label: 'Date Night', sub: 'Romantic · Dinner · Anniversary', handle: 'velvet-rose', c1: '#8a2149', c2: '#1a050e', glow: '#ff6b8f', line: 'Soft, warm and a little dangerous — made for close conversations.', fx: { type: 'up', glyphs: ['❤', '♥', '🌸'], color: '#ff8fab', n: 18 } },
    { key: 'event', icon: '💍', label: 'Wedding & Events', sub: 'Weddings · Eid · Special Occasions', handle: 'amber-dusk', c1: '#7a4c12', c2: '#150d03', glow: '#ffc857', line: 'Golden, rich and radiant — the scent of a day worth remembering.', fx: { type: 'up', glyphs: ['✦', '✧', '❖'], color: '#ffd77a', n: 20 } },
    { key: 'casual', icon: '☀️', label: 'Casual Day', sub: 'Daily · Weekend · Friends', handle: 'citrus-mist', c1: '#12806c', c2: '#031a17', glow: '#b6f542', line: 'Fresh, bright and effortless. Smell good without trying.', fx: { type: 'up', bubble: true, n: 16 } },
    { key: 'calm', icon: '🌙', label: 'Calm Evening', sub: 'Unwind · Night · Me-time', handle: 'moonpetal', c1: '#33337e', c2: '#07071a', glow: '#a9b4ff', line: 'Slow down. Dreamy, soft and quietly magnetic.', fx: { type: 'twinkle', glyphs: ['✦', '·', '☾'], color: '#d6dcff', n: 22 } },
  ],
  faqSection: { eyebrow: 'Got questions?', heading: 'Quick answers' },
  moodSection: { eyebrow: 'Find your scent', heading: "What's your mood today?" },
  contactSection: {
    eyebrow: 'Get in touch', submitLabel: 'Send message', successMessage: 'Thank you! We have received your message and will reply soon.',
    whatsappTitle: 'WhatsApp', emailTitle: 'Email', phoneTitle: 'Phone', hoursTitle: 'Hours',
    nameLabel: 'Name', emailLabel: 'Email', phoneLabel: 'Phone', messageLabel: 'Message',
  },
  home: {
    bestsellers: { eyebrow: 'Bestsellers', heading: 'The Signature Range', collection: 'all', layout: 'standard', limit: 8, bg: '#1c2a55' },
    newArrivals: { eyebrow: 'Just dropped', heading: 'New Arrivals', collection: 'all', layout: 'tall', limit: 8, bg: '#1c2a55' },
    sectionOrder: ['hero', 'trust', 'tiles', 'moods', 'bestsellers', 'offer', 'video', 'newArrivals', 'reviews', 'faq', 'newsletter'],
    sectionVisibility: { hero: true, trust: true, tiles: true, moods: true, bestsellers: true, offer: true, video: true, newArrivals: true, reviews: true, faq: true, newsletter: true },
  },
  pageSections: {
    aboutOrder: ['about', 'values', 'video', 'reviews', 'newsletter'],
    aboutVisibility: { about: true, values: true, video: true, reviews: true, newsletter: true },
    contactOrder: ['contact', 'faq'],
    contactVisibility: { contact: true, faq: true },
    productOrder: ['main', 'story', 'video', 'reviews', 'recommendations'],
    productVisibility: { main: true, story: true, video: true, reviews: true, recommendations: true },
  },
  appearance: {
    ink: '#17140f', ivory: '#fbf7ef', goldLight: '#f6dc8e', gold: '#d9a93f',
    goldDark: '#b8862b', navy: '#0b1530', navyLight: '#1a2a5c', buttonRadius: 99, contentWidth: 1200,
  },
};

export const site = createEditableProxy(baseContent.site, 'site');
export const announcement = createEditableProxy(baseContent.announcement, 'announcement');
export const layoutSettings = createEditableProxy(baseContent.layoutSettings, 'layoutSettings');
export const mainMenu = createEditableProxy(baseContent, 'root').mainMenu;
export const footerMenu = createEditableProxy(baseContent, 'root').footerMenu;
export const footer = createEditableProxy(baseContent.footer, 'footer');
export const extras = createEditableProxy(baseContent.extras, 'extras');
export const hero = createEditableProxy(baseContent.hero, 'hero');
export const tiles = createEditableProxy(baseContent.tiles, 'tiles');
export const offer = createEditableProxy(baseContent.offer, 'offer');
export const reviews = createEditableProxy(baseContent.reviews, 'reviews');
export const faq = createEditableProxy(baseContent, 'root').faq;
export const newsletter = createEditableProxy(baseContent.newsletter, 'newsletter');
export const video = createEditableProxy(baseContent.video, 'video');
export const about = createEditableProxy(baseContent.about, 'about');
export const values = createEditableProxy(baseContent.values, 'values');
export const contact = createEditableProxy(baseContent.contact, 'contact');
export const pdp = createEditableProxy(baseContent.pdp, 'pdp');
export const pdpStory = createEditableProxy(baseContent.pdpStory, 'pdpStory');
export const pdpReviews = createEditableProxy(baseContent.pdpReviews, 'pdpReviews');
export const trust = createEditableProxy(baseContent, 'root').trust;
export const moods = createEditableProxy(baseContent, 'root').moods;
export const moodSection = createEditableProxy(baseContent.moodSection, 'moodSection');
export const faqSection = createEditableProxy(baseContent.faqSection, 'faqSection');
export const contactSection = createEditableProxy(baseContent.contactSection, 'contactSection');
export const home = createEditableProxy(baseContent.home, 'home');
export const pageSections = createEditableProxy(baseContent.pageSections, 'pageSections');
export const appearance = createEditableProxy(baseContent.appearance, 'appearance');

const n = (g, name, key, pct) => ({ group: g, name, key, pct });
export const profiles = {
  obsidian: { perf: [92, 85, 70], notes: [n('Top Notes', 'Ginger', 'ginger', 80), n('Top Notes', 'Lemon', 'lemon', 60), n('Middle Notes', 'Lavender', 'lavender', 70), n('Middle Notes', 'Guaiac Wood', 'guaiac', 85), n('Base Notes', 'Oud', 'oud', 90), n('Base Notes', 'Amber', 'amber', 75), n('Base Notes', 'Musk', 'musk', 60)] },
  'velvet-rose': { perf: [85, 70, 55], notes: [n('Top Notes', 'Pink Grapefruit', 'grapefruit', 65), n('Middle Notes', 'Damask Rose', 'rose', 95), n('Middle Notes', 'Jasmine', 'jasmine', 75), n('Base Notes', 'Vanilla', 'vanilla', 80), n('Base Notes', 'White Musk', 'musk', 70), n('Base Notes', 'Amber', 'amber', 55)] },
  moonpetal: { perf: [78, 65, 75], notes: [n('Top Notes', 'Lemon', 'lemon', 60), n('Top Notes', 'Mint', 'mint', 45), n('Middle Notes', 'Jasmine', 'jasmine', 95), n('Middle Notes', 'Lavender', 'lavender', 60), n('Base Notes', 'White Musk', 'musk', 85), n('Base Notes', 'Vanilla', 'vanilla', 60)] },
  'amber-dusk': { perf: [95, 90, 35], notes: [n('Top Notes', 'Ginger', 'ginger', 75), n('Middle Notes', 'Rose', 'rose', 55), n('Middle Notes', 'Guaiac Wood', 'guaiac', 70), n('Base Notes', 'Amber', 'amber', 95), n('Base Notes', 'Oud', 'oud', 75), n('Base Notes', 'Vanilla', 'vanilla', 70)] },
  'citrus-mist': { perf: [72, 65, 96], notes: [n('Top Notes', 'Grapefruit', 'grapefruit', 90), n('Top Notes', 'Lemon', 'lemon', 85), n('Top Notes', 'Mint', 'mint', 70), n('Middle Notes', 'Marine Accord', 'marine', 75), n('Middle Notes', 'Jasmine', 'jasmine', 50), n('Base Notes', 'Cedarwood', 'cedar', 60), n('Base Notes', 'White Musk', 'musk', 65)] },
};
export const profileFor = handle => {
  const k = Object.keys(profiles).find(k => String(handle).includes(k));
  return k ? profiles[k] : null;
};
