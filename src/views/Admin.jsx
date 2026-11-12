'use client';
import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, money } from '../lib/format.js';
import { discountedPrice, isValidDiscountPercent } from '../lib/pricing.js';
import { applySiteAppearance, getSiteContentSnapshot, setSiteContentOverrides } from '../data/siteContent.js';
import SiteContentEditor from '../components/SiteContentEditor.jsx';
import AdminReviews from '../components/AdminReviews.jsx';
import { uploadBrandVideo } from '../lib/brand-video.js';
import { prepareCollectionImage } from '../lib/collection-images.js';
import '../styles/admin.css';

const BUCKET = 'ameza-product-images';
const ORDER_STATUSES = ['unfulfilled', 'shipped', 'delivered', 'cancelled'];
const LOW_STOCK_LIMIT = 5;
const emptyStory = () => ({
  eyebrow: '', heading: '', description: '', image: '', quote: '',
  stats: getSiteContentSnapshot().pdpStory.stats.map(([value, label]) => [value, label]),
});
const emptyForm = () => ({ title: '', price: '', discountPercent: '0', description: '', category: '', stock: '0', images: [], published: true, variantId: '', collectionIds: [], fragrance: { topNotes: '', heartNotes: '', baseNotes: '', family: '', concentration: '', longevity: '', sillage: '', ingredients: '', description: '', story: emptyStory() } });
const errorMessage = error => error?.message || 'Something went wrong. Please try again.';
const collectionLabel = collection => ({
  men: 'For Him',
  women: 'For Her',
  'gift-sets': 'Unisex',
}[collection.handle] || collection.title);

const slugifyHandle = title => title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const productHandle = title => slugifyHandle(title) || `perfume-${Date.now()}`;

export default function Admin() {
  const { enabled, ready, user, signInAdmin, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collectionForm, setCollectionForm] = useState({ title: '', handle: '', description: '', image: '' });
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionLinks, setCollectionLinks] = useState([]);
  const [section, setSection] = useState('products');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [orderSort, setOrderSort] = useState('newest');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderActionId, setOrderActionId] = useState(null);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contentForm, setContentForm] = useState(() => getSiteContentSnapshot());
  const [files, setFiles] = useState([]);
  const [storyImageFile, setStoryImageFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storeWarning, setStoreWarning] = useState('');
  const discountPercent = Number(form.discountPercent);
  const discountValid = form.discountPercent.trim() !== '' && isValidDiscountPercent(discountPercent);
  const previewBasePrice = Number(form.price);
  const previewPrice = form.price.trim() !== '' && Number.isFinite(previewBasePrice) && previewBasePrice >= 0 && discountValid
    ? discountedPrice(previewBasePrice, discountPercent)
    : null;

  const pendingOrders = orders.filter(order => order.confirmation_status === 'pending');
  const confirmedOrders = orders.filter(order => order.confirmation_status === 'confirmed');
  const unpaidWalletOrders = orders.filter(order =>
    ['jazzcash', 'easypaisa'].includes(order.payment_method) && order.payment_status !== 'paid'
    && order.confirmation_status !== 'rejected');
  const filteredOrders = orders
    .filter(order => orderStatusFilter === 'all' || (order.confirmation_status || 'confirmed') === orderStatusFilter)
    .filter(order => orderPaymentFilter === 'all' || order.payment_method === orderPaymentFilter)
    .filter(order => {
      const address = order.shipping_address || {};
      const search = orderSearch.trim().toLowerCase();
      if (!search) return true;
      return [
        order.order_number, order.email, order.phone, order.payment_reference,
        address.firstName, address.lastName, address.address1, address.city,
        ...(order.order_items || []).flatMap(item => [item.title, item.variant_title]),
      ].some(value => String(value || '').toLowerCase().includes(search));
    })
    .sort((a, b) => orderSort === 'oldest'
      ? new Date(a.created_at) - new Date(b.created_at)
      : orderSort === 'highest'
        ? Number(b.total) - Number(a.total)
        : new Date(b.created_at) - new Date(a.created_at));
  const lowStockProducts = products.filter(product =>
    (product.product_variants || []).some(variant => variant.inventory_quantity <= LOW_STOCK_LIMIT));
  const outOfStockVariants = products.flatMap(product => product.product_variants || [])
    .filter(variant => variant.inventory_quantity <= 0).length;

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      if (!ready) return;
      if (!enabled || !user) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: isAdmin, error: accessError } = await supabase.rpc('is_admin');
        if (accessError) throw accessError;
        if (!active) return;
        setAuthorized(Boolean(isAdmin));
        if (!isAdmin) {
          setLoading(false);
          return;
        }
        try {
          const status = await api('/status');
          setStoreWarning(status.store === 'Supabase'
            ? ''
            : 'The storefront API is using local seed data, not Supabase. Products added here will not appear in the store until the backend is configured with the same SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as the frontend Supabase project.');
        } catch (statusError) {
          setStoreWarning(`Could not verify the storefront catalogue source: ${errorMessage(statusError)}`);
        }
        const [productResult, orderResult, collectionResult, collectionLinkResult, siteContentResult] = await Promise.all([
          supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false }),
          supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100),
          supabase.from('collections').select('id, handle, title, description, image, sort_order').order('sort_order'),
          supabase.from('collection_products').select('collection_id, product_id'),
          supabase.from('site_content').select('content').eq('id', 'default').maybeSingle(),
        ]);
        if (productResult.error) throw productResult.error;
        if (orderResult.error) throw orderResult.error;
        if (collectionResult.error) throw collectionResult.error;
        if (collectionLinkResult.error) throw collectionLinkResult.error;
        if (siteContentResult.error) throw siteContentResult.error;
        if (!active) return;
        setProducts(productResult.data || []);
        setOrders(orderResult.data || []);
        setCollections((collectionResult.data || []).filter(collection => collection.handle !== 'all'));
        setCollectionLinks(collectionLinkResult.data || []);
        setContentForm(getSiteContentSnapshot(siteContentResult.data?.content));
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    loadDashboard();
    return () => { active = false; };
  }, [ready, enabled, user]);

  function startNewProduct() {
    setSelected(null);
    setForm(emptyForm());
    setFiles([]);
    setStoryImageFile(null);
    setError('');
    setNotice('');
  }

  function editProduct(product) {
    const variant = [...(product.product_variants || [])].sort((a, b) => a.position - b.position)[0];
    const fragrance = product.fragrance || {};
    const story = fragrance.story || {};
    setSelected(product);
    setForm({
      title: product.title,
      price: variant ? String(variant.price) : '',
      discountPercent: String(product.discount_percent ?? 0),
      description: product.description_html || '',
      category: product.product_type || '',
      stock: variant ? String(variant.inventory_quantity) : '0',
      images: product.images || [],
      published: product.published,
      variantId: variant?.id || '',
      collectionIds: collectionLinks.filter(link => link.product_id === product.id).map(link => link.collection_id),
      fragrance: {
        topNotes: fragrance.topNotes || fragrance.top_notes || '',
        heartNotes: fragrance.heartNotes || fragrance.heart_notes || '',
        baseNotes: fragrance.baseNotes || fragrance.base_notes || '',
        family: fragrance.family || '',
        concentration: fragrance.concentration || '',
        longevity: fragrance.longevity || '',
        sillage: fragrance.sillage || '',
        ingredients: fragrance.ingredients || '',
        description: fragrance.description || '',
        story: {
          eyebrow: story.eyebrow || '',
          heading: story.heading || '',
          description: story.description || '',
          image: story.image || '',
          quote: story.quote || '',
          stats: Array.isArray(story.stats)
            ? story.stats.map(stat => Array.isArray(stat) ? [stat[0] || '', stat[1] || ''] : ['', '']).slice(0, 3)
            : emptyStory().stats,
        },
      },
    });
    setFiles([]);
    setStoryImageFile(null);
    setError('');
    setNotice('');
  }

  async function uploadImages(imageFiles = files) {
    const uploaded = [];
    try {
      for (const file of imageFiles) {
        const safeName = file.name.replace(/[^\w.-]+/g, '-');
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      return uploaded;
    } catch (uploadError) {
      const paths = uploaded.map(url => url.split(`/storage/v1/object/public/${BUCKET}/`)[1]).filter(Boolean);
      if (paths.length) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove(paths);
        if (cleanupError) throw new Error(`${errorMessage(uploadError)} Image cleanup failed: ${cleanupError.message}`);
      }
      throw uploadError;
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    let createdId = null;
    let productSaved = false;
    try {
      const price = Number(form.price);
      const stock = Number(form.stock);
      if (!form.title.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
        throw new Error('Enter a product name, a valid non-negative PKR price, and a whole-number stock quantity.');
      }
      if (!form.discountPercent.trim() || !isValidDiscountPercent(discountPercent)) {
        throw new Error('Enter a discount percentage between 0 and 100.');
      }
      const allUploaded = await uploadImages([...files, ...(storyImageFile ? [storyImageFile] : [])]);
      const uploaded = allUploaded.slice(0, files.length);
      const storyImage = storyImageFile ? allUploaded[files.length] : form.fragrance.story.image.trim();
      const values = {
        title: form.title.trim(),
        description_html: form.description,
        product_type: form.category.trim(),
        images: [...form.images, ...uploaded],
        discount_percent: discountPercent,
        published: form.published,
        fragrance: {
          topNotes: form.fragrance.topNotes.trim(),
          heartNotes: form.fragrance.heartNotes.trim(),
          baseNotes: form.fragrance.baseNotes.trim(),
          family: form.fragrance.family.trim(),
          concentration: form.fragrance.concentration.trim(),
          longevity: form.fragrance.longevity.trim(),
          sillage: form.fragrance.sillage.trim(),
          ingredients: form.fragrance.ingredients.trim(),
          description: form.fragrance.description.trim(),
          story: {
            eyebrow: form.fragrance.story.eyebrow.trim(),
            heading: form.fragrance.story.heading.trim(),
            description: form.fragrance.story.description.trim(),
            image: storyImage || '',
            quote: form.fragrance.story.quote.trim(),
            stats: form.fragrance.story.stats
              .map(([value, label]) => [value.trim(), label.trim()])
              .filter(([value, label]) => value && label),
          },
        },
      };
      let product = selected;
      if (selected) {
        const { data, error: updateError } = await supabase.from('products').update(values).eq('id', selected.id).select().single();
        if (updateError) throw updateError;
        product = data;
      } else {
        const { data, error: insertError } = await supabase.from('products').insert({
          ...values,
          handle: productHandle(values.title),
          vendor: 'Améza',
        }).select().single();
        if (insertError) throw insertError;
        product = data;
        createdId = data.id;
      }
      productSaved = true;

      const variants = [...(selected?.product_variants || [])].sort((a, b) => a.position - b.position);
      const variant = variants.find(item => item.id === form.variantId) || variants[0];
      const variantValues = { price, inventory_quantity: stock };
      const variantResult = variant
        ? await supabase.from('product_variants').update(variantValues).eq('id', variant.id)
        : await supabase.from('product_variants').insert({ ...variantValues, product_id: product.id, title: 'Default Title' });
      if (variantResult.error) {
        if (createdId) {
          const { error: rollbackError } = await supabase.from('products').delete().eq('id', createdId);
          if (rollbackError) throw new Error(`${variantResult.error.message} Product cleanup failed: ${rollbackError.message}`);
          productSaved = false;
        }
        throw variantResult.error;
      }
      const { error: collectionError } = await supabase.rpc('admin_set_product_collections', {
        p_product_id: product.id,
        p_collection_ids: form.collectionIds,
      });
      if (collectionError) throw new Error(`Product saved, but collection assignments could not be updated: ${collectionError.message}`);
      setNotice(selected ? 'Product updated.' : 'Product added.');
      setSelected(null);
      setForm(emptyForm());
      setFiles([]);
      setStoryImageFile(null);
      const [productResult, linkResult] = await Promise.all([
        supabase.from('products').select('*, product_variants(*)').order('created_at', { ascending: false }),
        supabase.from('collection_products').select('collection_id, product_id'),
      ]);
      if (productResult.error) throw productResult.error;
      if (linkResult.error) throw linkResult.error;
      setProducts(productResult.data || []);
      setCollectionLinks(linkResult.data || []);
    } catch (saveError) {
      setError(productSaved
        ? `Product saved, but some updates failed: ${errorMessage(saveError)}`
        : errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    try {
      const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id);
      if (deleteError) throw deleteError;
      setProducts(current => current.filter(item => item.id !== product.id));
      setCollectionLinks(current => current.filter(link => link.product_id !== product.id));
      if (selected?.id === product.id) startNewProduct();
      setNotice('Product deleted.');
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  }

  async function updateOrderStatus(orderId, fulfillment_status) {
    setError('');
    setNotice('');
    setOrderActionId(orderId);
    try {
      const { data, error: updateError } = await supabase.from('orders').update({ fulfillment_status }).eq('id', orderId).select().single();
      if (updateError) throw updateError;
      setOrders(current => current.map(order => order.id === orderId ? { ...order, ...data } : order));
      setNotice(`Order #${data.order_number} updated.`);
    } catch (updateError) {
      setError(errorMessage(updateError));
    } finally {
      setOrderActionId(null);
    }
  }

  async function verifyOrderPayment(order) {
    if (!window.confirm(`Have you verified the ${order.payment_method} transfer for order #${order.order_number} in the receiving account?`)) return;
    setError('');
    setNotice('');
    setOrderActionId(order.id);
    try {
      const { data, error: paymentError } = await supabase.from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id)
        .eq('payment_status', 'pending')
        .select()
        .single();
      if (paymentError) throw paymentError;
      setOrders(current => current.map(item => item.id === order.id ? { ...item, ...data } : item));
      setNotice(`Payment for order #${order.order_number} marked as verified.`);
    } catch (paymentError) {
      setError(errorMessage(paymentError));
    } finally {
      setOrderActionId(null);
    }
  }

  async function decideOrder(order, decision) {
    setError('');
    setNotice('');
    setOrderActionId(order.id);
    try {
      const { data, error: decisionError } = await supabase.rpc('admin_set_order_confirmation', {
        p_order_id: order.id,
        p_decision: decision,
      });
      if (decisionError) throw decisionError;
      setOrders(current => current.map(item => item.id === order.id
        ? { ...item, confirmation_status: data }
        : item));
      if (decision === 'rejected') {
        const { data: refreshed, error: refreshError } = await supabase.from('products')
          .select('*, product_variants(*)').order('created_at', { ascending: false });
        if (refreshError) throw refreshError;
        setProducts(refreshed || []);
      }
      setNotice(`Order #${order.order_number} ${decision}.`);
    } catch (decisionError) {
      setError(errorMessage(decisionError));
    } finally {
      setOrderActionId(null);
    }
  }

  async function refreshOrders() {
    setOrdersRefreshing(true);
    setError('');
    setNotice('');
    try {
      const { data, error: refreshError } = await supabase.from('orders')
        .select('*, order_items(*)').order('created_at', { ascending: false }).limit(100);
      if (refreshError) throw refreshError;
      setOrders(data || []);
      setNotice('Orders refreshed.');
    } catch (refreshError) {
      setError(errorMessage(refreshError));
    } finally {
      setOrdersRefreshing(false);
    }
  }

  async function saveWebsiteContent(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const payload = contentForm;
      const { error: saveError } = await supabase.from('site_content').upsert({
        id: 'default',
        content: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (saveError) throw saveError;
      setSiteContentOverrides(payload);
      applySiteAppearance(payload.appearance);
      setNotice('Storefront content saved. Reload the storefront to see the updates.');
    } catch (contentError) {
      setError(errorMessage(contentError));
    } finally {
      setBusy(false);
    }
  }

  async function saveCollection(event) {
      event.preventDefault();
      setError('');
      setNotice('');
      setBusy(true);
      try {
        const title = collectionForm.title.trim();
        const handle = slugifyHandle(collectionForm.handle.trim() || title);
        if (!title) throw new Error('Enter a collection name.');
        if (!handle) throw new Error('Use a collection name with at least one letter or number.');
        if (handle === 'all') throw new Error('The handle "all" is reserved for the full catalogue.');
        const values = {
          title,
          handle,
          description: collectionForm.description.trim(),
          image: collectionForm.image?.trim() ?? null,
        };
        const result = selectedCollection
          ? await supabase.from('collections').update(values).eq('id', selectedCollection.id).select('id, handle, title, description, image, sort_order').single()
          : await supabase.from('collections').insert({ ...values, sort_order: collections.length }).select('id, handle, title, description, image, sort_order').single();
        if (result.error) throw result.error;
        setCollections(current => selectedCollection
          ? current.map(item => item.id === selectedCollection.id ? result.data : item)
          : [...current, result.data].sort((a, b) => a.sort_order - b.sort_order));
        setSelectedCollection(null);
        setCollectionForm({ title: '', handle: '', description: '', image: '' });
        setNotice(selectedCollection ? 'Collection updated.' : 'Collection created. Assign perfumes to it to make it show products.');
      } catch (collectionError) {
        setError(errorMessage(collectionError));
      } finally {
        setBusy(false);
      }
    }

  async function deleteCollection(collection) {
      if (!window.confirm(`Delete "${collection.title}"? Products will remain, but their collection assignment will be removed.`)) return;
      setError('');
      setNotice('');
      try {
        const { error: deleteError } = await supabase.from('collections').delete().eq('id', collection.id);
        if (deleteError) throw deleteError;
        setCollections(current => current.filter(item => item.id !== collection.id));
        setCollectionLinks(current => current.filter(link => link.collection_id !== collection.id));
        if (selectedCollection?.id === collection.id) {
          setSelectedCollection(null);
          setCollectionForm({ title: '', handle: '', description: '', image: '' });
        }
        setNotice(`Collection "${collection.title}" deleted.`);
      } catch (deleteError) {
        setError(errorMessage(deleteError));
      }
    }

  function editCollection(collection) {
      setSelectedCollection(collection);
      setCollectionForm({
        title: collection.title,
        handle: collection.handle,
        description: collection.description || '',
        image: collection.image ?? null,
      });
      setError('');
      setNotice('');
    }

  async function uploadContentImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Images must be smaller than 10 MB.');
    const safeName = file.name.replace(/[^\w.-]+/g, '-');
    const path = `site-content/${user.id}/${crypto.randomUUID()}-${safeName}`;
    setBusy(true);
    try {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } finally {
      setBusy(false);
    }
  }

  async function uploadContentVideo(file) {
    setBusy(true);
    try {
      return await uploadBrandVideo(supabase.storage, user.id, file);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    try {
      await signInAdmin(username, password);
    } catch (loginError) {
      setError(errorMessage(loginError));
    }
  }

  if (!enabled) {
    return <main className="admin-login"><h1>AMÉZA Admin</h1><p>Configure the Supabase URL and anon key to use the dashboard.</p></main>;
  }
  if (!ready || loading) return <main className="admin-login"><p>Loading admin dashboard…</p></main>;
  if (!user) {
    return (
      <main className="admin-login">
        <form className="admin-login__card" onSubmit={submitLogin}>
          <p className="admin-eyebrow">AMÉZA</p><h1>Admin sign in</h1>
          {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
          <label>Username<input autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></label>
          <label>Password
            <span className="admin-password-field">
              <input type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
              <button
                className="admin-password-toggle"
                type="button"
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible(visible => !visible)}
              >
                {passwordVisible ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 5.1 9 6-.3.6-1.6 2.5-3.7 3.9" />
                    <path d="M6.2 6.2C4.1 7.5 2.8 9.5 3 11c.5.9 3.8 8 9 8 1.1 0 2.1-.3 3-.8" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </span>
          </label>
          <button className="admin-button" type="submit">Sign in</button>
          <a href="/">Return to storefront</a>
        </form>
      </main>
    );
  }
  if (!authorized) {
    return (
      <main className="admin-login">
        <section className="admin-login__card">
          <p className="admin-eyebrow">AMÉZA</p><h1>Admin access required</h1>
          <p>This account is signed in, but is not authorized to manage the store.</p>
          {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
          <button className="admin-button" onClick={() => signOut().catch(signOutError => setError(errorMessage(signOutError)))}>Sign out</button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="admin-eyebrow">AMÉZA</p><h1>Store dashboard</h1></div>
        <div className="admin-header__actions"><a href="/">View storefront</a><button className="admin-button admin-button--quiet" onClick={() => signOut().catch(signOutError => setError(errorMessage(signOutError)))}>Sign out</button></div>
      </header>
      <nav className="admin-tabs" aria-label="Dashboard sections">
        <button className={section === 'reviews' ? 'is-active' : ''} onClick={() => setSection('reviews')}>Reviews</button>
        <button className={section === 'products' ? 'is-active' : ''} onClick={() => setSection('products')}>Perfumes <span>{products.length}</span></button>
        <button className={section === 'collections' ? 'is-active' : ''} onClick={() => setSection('collections')}>Collections <span>{collections.length}</span></button>
        <button className={section === 'orders' ? 'is-active' : ''} onClick={() => setSection('orders')}>Orders <span>{orders.length}{pendingOrders.length > 0 ? ` · ${pendingOrders.length} pending` : ''}</span></button>
        <button className={section === 'content' ? 'is-active' : ''} onClick={() => setSection('content')}>Website Content</button>
      </nav>
      <section className="admin-overview" aria-label="Store overview">
        <article className="admin-panel admin-metric"><p className="admin-eyebrow">Needs attention</p><strong>{pendingOrders.length}</strong><span>Orders awaiting confirmation</span></article>
        <article className="admin-panel admin-metric"><p className="admin-eyebrow">Inventory</p><strong>{lowStockProducts.length}</strong><span>Low-stock products · {outOfStockVariants} variants out of stock</span></article>
      </section>
      {error && <p className="admin-alert admin-alert--error" role="alert">{error}</p>}
      {notice && <p className="admin-alert admin-alert--success" role="status">{notice}</p>}
      {storeWarning && <p className="admin-alert admin-alert--error" role="alert">{storeWarning}</p>}

      {section === 'reviews' ? <AdminReviews products={products} /> : section === 'products' ? (
        <div className="admin-products">
          <section className="admin-panel admin-product-form">
            <div className="admin-panel__heading"><div><p className="admin-eyebrow">{selected ? 'Edit listing' : 'Catalogue'}</p><h2>{selected ? 'Edit perfume' : 'Add a perfume'}</h2></div>
              {selected && <button className="admin-text-button" type="button" onClick={startNewProduct}>Cancel edit</button>}</div>
            <form onSubmit={saveProduct}>
              <label>Perfume name<input required maxLength="120" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
              {selected?.product_variants?.length > 1 && <label>Variant price and stock<select value={form.variantId} onChange={event => {
                const variant = selected.product_variants.find(item => item.id === event.target.value);
                setForm({ ...form, variantId: variant.id, price: String(variant.price), stock: String(variant.inventory_quantity) });
              }}>
                {[...selected.product_variants].sort((a, b) => a.position - b.position).map(variant => <option key={variant.id} value={variant.id}>{variant.title}</option>)}
              </select></label>}
              <div className="admin-fields-row">
                <label>Price (PKR)<input required type="number" min="0" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} /></label>
                <label>Stock quantity<input required type="number" min="0" step="1" value={form.stock} onChange={event => setForm({ ...form, stock: event.target.value })} /></label>
              </div>
              <label>Discount (%)<input required type="number" min="0" max="100" step="0.01" value={form.discountPercent} onChange={event => setForm({ ...form, discountPercent: event.target.value })} /></label>
              <div className="admin-discount-preview" aria-live="polite">
                {previewPrice === null
                  ? <span>Enter a valid price and discount to preview the selling price.</span>
                  : <>
                    <div><span>Original price</span><b>{money(previewBasePrice)}</b></div>
                    <div><span>Discount</span><b>{discountPercent}%</b></div>
                    <div><span>Final selling price</span><b>{money(previewPrice)}</b></div>
                  </>}
              </div>
              <label>Category<input maxLength="80" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder="e.g. Women, Men, Oud" /></label>
              <fieldset className="admin-collection-picker">
                <legend>Collections</legend>
                <p className="admin-muted">Choose every collection where this perfume should appear.</p>
                {collections.length ? collections.map(collection => (
                  <label className="admin-checkbox" key={collection.id}>
                    <input
                      type="checkbox"
                      checked={form.collectionIds.includes(collection.id)}
                      onChange={event => setForm({
                        ...form,
                        collectionIds: event.target.checked
                          ? [...form.collectionIds, collection.id]
                          : form.collectionIds.filter(id => id !== collection.id),
                      })}
                    />
                    {collectionLabel(collection)}
                  </label>
                )) : <p className="admin-muted">No collections are configured yet.</p>}
              </fieldset>
              <label>Description<textarea rows="5" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
              <fieldset className="admin-collection-picker">
                <legend>Fragrance details</legend>
                <div className="admin-fields-row">
                  <label>Fragrance family<input value={form.fragrance.family} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, family: event.target.value } })} placeholder="e.g. Woody, Floral" /></label>
                  <label>Concentration<input value={form.fragrance.concentration} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, concentration: event.target.value } })} placeholder="e.g. EDP" /></label>
                </div>
                <div className="admin-fields-row">
                  <label>Longevity<input value={form.fragrance.longevity} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, longevity: event.target.value } })} placeholder="e.g. 8–10 hours" /></label>
                  <label>Sillage<input value={form.fragrance.sillage} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, sillage: event.target.value } })} placeholder="e.g. Moderate" /></label>
                </div>
                <label>Top notes<textarea rows="2" value={form.fragrance.topNotes} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, topNotes: event.target.value } })} /></label>
                <label>Heart notes<textarea rows="2" value={form.fragrance.heartNotes} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, heartNotes: event.target.value } })} /></label>
                <label>Base notes<textarea rows="2" value={form.fragrance.baseNotes} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, baseNotes: event.target.value } })} /></label>
                <label>Ingredients<textarea rows="2" value={form.fragrance.ingredients} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, ingredients: event.target.value } })} /></label>
                <label>Fragrance description<textarea rows="3" value={form.fragrance.description} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, description: event.target.value } })} /></label>
              </fieldset>
              <fieldset className="admin-collection-picker">
                <legend>Our Story</legend>
                <label>Story eyebrow<input value={form.fragrance.story.eyebrow} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, eyebrow: event.target.value } } })} placeholder="Our story" /></label>
                <label>Story heading / tagline<input value={form.fragrance.story.heading} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, heading: event.target.value } } })} /></label>
                <label>Story description / content<textarea rows="5" value={form.fragrance.story.description} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, description: event.target.value } } })} /></label>
                <label>Story quote<input value={form.fragrance.story.quote} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, quote: event.target.value } } })} /></label>
                {form.fragrance.story.stats.map(([value, label], index) => (
                  <div className="admin-fields-row" key={index}>
                    <label>Story detail {index + 1} value<input value={value} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, stats: form.fragrance.story.stats.map((stat, i) => i === index ? [event.target.value, stat[1]] : stat) } } })} /></label>
                    <label>Story detail {index + 1} label<input value={label} onChange={event => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, stats: form.fragrance.story.stats.map((stat, i) => i === index ? [stat[0], event.target.value] : stat) } } })} /></label>
                  </div>
                ))}
                <label>Story image<input key={storyImageFile ? 'story-image-selected' : 'story-image-empty'} type="file" accept="image/*" onChange={event => setStoryImageFile(event.target.files?.[0] || null)} /></label>
                {storyImageFile
                  ? <p className="admin-muted">{storyImageFile.name} <button className="admin-text-button" type="button" onClick={() => setStoryImageFile(null)}>Clear selection</button></p>
                  : form.fragrance.story.image
                    ? <div className="admin-image-list"><div><img src={form.fragrance.story.image} alt="" /><button type="button" aria-label="Remove story image" onClick={() => setForm({ ...form, fragrance: { ...form.fragrance, story: { ...form.fragrance.story, image: '' } } })}>×</button></div></div>
                    : <p className="admin-muted">If no story image is set, the storefront uses this product’s own image.</p>}
              </fieldset>
              <label>Product images<input type="file" accept="image/*" multiple onChange={event => setFiles(Array.from(event.target.files || []))} /></label>
              {files.length > 0 && <p className="admin-muted">{files.length} image(s) ready to upload</p>}
              {form.images.length > 0 && (
                <div className="admin-image-list">{form.images.map(image => <div key={image}>
                  <img src={image} alt="" /><button type="button" aria-label="Remove image" onClick={() => setForm({ ...form, images: form.images.filter(item => item !== image) })}>×</button>
                </div>)}</div>
              )}
              <label className="admin-checkbox"><input type="checkbox" checked={form.published} onChange={event => setForm({ ...form, published: event.target.checked })} /> Published on storefront</label>
              <button className="admin-button" type="submit" disabled={busy}>{busy ? 'Saving…' : selected ? 'Save changes' : 'Add perfume'}</button>
            </form>
          </section>

          <section className="admin-panel">
            <div className="admin-panel__heading"><div><p className="admin-eyebrow">Catalogue</p><h2>Perfumes</h2></div><span className="admin-count">{products.length} total</span></div>
            {products.length ? <div className="admin-product-list">{products.map(product => {
              const variant = [...(product.product_variants || [])].sort((a, b) => a.position - b.position)[0];
              const assignedCollections = collectionLinks
                .filter(link => link.product_id === product.id)
                .map(link => collections.find(collection => collection.id === link.collection_id))
                .filter(Boolean)
                .map(collectionLabel);
              return <article className="admin-product-row" key={product.id}>
                <div className="admin-product-row__image">{product.images?.[0] && <img src={product.images[0]} alt="" />}</div>
                <div className="admin-product-row__info"><b>{product.title}</b><span>{product.product_type || 'Uncategorized'} · {money(variant?.price || 0)} · Stock {variant?.inventory_quantity ?? 0}</span><small>{product.published ? 'Published' : 'Draft'}</small><small>Collections: {assignedCollections.join(', ') || 'None'}</small></div>
                <div className="admin-row-actions"><button className="admin-text-button" onClick={() => editProduct(product)}>Edit</button><button className="admin-text-button admin-text-button--danger" onClick={() => deleteProduct(product)}>Delete</button></div>
              </article>;
            })}</div> : <p className="admin-empty">No perfumes yet. Add your first perfume using the form.</p>}
          </section>
        </div>
      ) : section === 'collections' ? (
        <div className="admin-products admin-collections">
          <section className="admin-panel admin-product-form">
            <div className="admin-panel__heading">
              <div><p className="admin-eyebrow">{selectedCollection ? 'Edit collection' : 'Catalogue'}</p><h2>{selectedCollection ? 'Update collection' : 'Add a collection'}</h2></div>
              {selectedCollection && <button className="admin-text-button" type="button" disabled={busy} onClick={() => {
                setSelectedCollection(null);
                setCollectionForm({ title: '', handle: '', description: '', image: '' });
              }}>Cancel edit</button>}
            </div>
            <form onSubmit={saveCollection}>
              <label>Collection name<input required maxLength="120" value={collectionForm.title} onChange={event => setCollectionForm({ ...collectionForm, title: event.target.value, handle: selectedCollection ? collectionForm.handle : slugifyHandle(event.target.value) })} placeholder="e.g. Attar" /></label>
              <label>URL handle<input required maxLength="120" value={collectionForm.handle} onChange={event => setCollectionForm({ ...collectionForm, handle: slugifyHandle(event.target.value) })} placeholder="attar" /></label>
              <label>Description<textarea rows="4" value={collectionForm.description} onChange={event => setCollectionForm({ ...collectionForm, description: event.target.value })} /></label>
              <label>Collection image URL<input disabled={busy} value={collectionForm.image || ''} onChange={event => setCollectionForm({ ...collectionForm, image: event.target.value })} placeholder="Upload an image below or paste a URL" /></label>
              <label>{collectionForm.image ? 'Replace cover image' : 'Upload cover image'}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={busy} onChange={async event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setError('');
                setBusy(true);
                try {
                  const optimized = await prepareCollectionImage(file);
                  const image = await uploadContentImage(optimized);
                  setCollectionForm(current => ({ ...current, image }));
                } catch (uploadError) {
                  setError(errorMessage(uploadError));
                } finally {
                  setBusy(false);
                }
              }} /></label>
              <p className="admin-muted">JPG, PNG, or WebP, up to 10 MB. Large images are resized to 1600px. Save the collection to publish image changes.</p>
              {collectionForm.image && <img className="admin-collection-preview" src={collectionForm.image} alt="Collection cover preview" />}
              {collectionForm.image && <button className="admin-text-button admin-text-button--danger" type="button" disabled={busy} onClick={() => setCollectionForm(current => ({ ...current, image: '' }))}>Remove cover image</button>}
              <button className="admin-button" type="submit" disabled={busy}>{busy ? 'Saving…' : selectedCollection ? 'Save collection' : 'Create collection'}</button>
            </form>
          </section>
          <section className="admin-panel">
            <div className="admin-panel__heading"><div><p className="admin-eyebrow">Catalogue</p><h2>Collections</h2></div><span className="admin-count">{collections.length} total</span></div>
            {collections.length ? <div className="admin-product-list">{collections.map(collection => {
              const productCount = collectionLinks.filter(link => link.collection_id === collection.id).length;
              return <article className="admin-product-row" key={collection.id}>
                <div className="admin-product-row__image">{collection.image && <img src={collection.image} alt="" />}</div>
                <div className="admin-product-row__info"><b>{collection.title}</b><span>/collections/{collection.handle}</span><small>{productCount} assigned perfume{productCount === 1 ? '' : 's'}</small></div>
                <div className="admin-row-actions"><button className="admin-text-button" disabled={busy} onClick={() => editCollection(collection)}>Edit</button><button className="admin-text-button admin-text-button--danger" disabled={busy} onClick={() => deleteCollection(collection)}>Delete</button></div>
              </article>;
            })}</div> : <p className="admin-empty">No collections yet. Create your first collection.</p>}
          </section>
        </div>
      ) : section === 'orders' ? (
        <section className="admin-panel admin-orders">
          <div className="admin-panel__heading">
            <div><p className="admin-eyebrow">Orders</p><h2>Orders</h2></div>
            <div className="admin-orders__heading-actions">
              <span className="admin-count">Showing {filteredOrders.length} of latest {orders.length}</span>
              <button className="admin-button admin-button--quiet" type="button" onClick={refreshOrders} disabled={ordersRefreshing}>
                {ordersRefreshing ? 'Refreshing…' : 'Refresh orders'}
              </button>
            </div>
          </div>
          <div className="admin-order-summary" aria-label="Order summary">
            <div><span>Awaiting review</span><b>{pendingOrders.length}</b></div>
            <div><span>Confirmed</span><b>{confirmedOrders.length}</b></div>
            <div><span>Wallet payment to verify</span><b>{unpaidWalletOrders.length}</b></div>
          </div>
          {lowStockProducts.length > 0 && <div className="admin-stock-alert">
            <b>Low stock</b>
            <span>{lowStockProducts.map(product => {
              const lowest = Math.min(...(product.product_variants || []).map(variant => variant.inventory_quantity));
              return `${product.title} (${lowest})`;
            }).join(' · ')}</span>
          </div>}
          {orders.length > 0 && <>
            <div className="admin-order-tools">
              <label className="admin-order-search">Search orders
                <input type="search" value={orderSearch} onChange={event => setOrderSearch(event.target.value)} placeholder="Order #, customer, phone, item or payment ref" />
              </label>
              <label>Confirmation
                <select value={orderStatusFilter} onChange={event => setOrderStatusFilter(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="pending">Awaiting review</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>Payment
                <select value={orderPaymentFilter} onChange={event => setOrderPaymentFilter(event.target.value)}>
                  <option value="all">All methods</option>
                  <option value="cod">Cash on delivery</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">Easypaisa</option>
                </select>
              </label>
              <label>Sort by
                <select value={orderSort} onChange={event => setOrderSort(event.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="highest">Highest total</option>
                </select>
              </label>
            </div>
            {filteredOrders.length ? <div className="admin-table-scroll"><table>
              <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Placed</th><th>Payment</th><th>Confirmation / fulfillment</th></tr></thead>
              <tbody>{filteredOrders.map(order => {
                const confirmation = order.confirmation_status || 'confirmed';
                const address = order.shipping_address || {};
                const expanded = expandedOrderId === order.id;
                const actionBusy = orderActionId === order.id;
                return <Fragment key={order.id}>
                  <tr>
                    <td><b>#{order.order_number}</b><span className={`admin-order-badge admin-order-badge--${confirmation}`}>{confirmation}</span>
                      <button className="admin-text-button admin-order-details-toggle" type="button" aria-expanded={expanded} onClick={() => setExpandedOrderId(expanded ? null : order.id)}>{expanded ? 'Hide details' : 'Details'}</button>
                    </td>
                    <td>{order.email}<small>{order.phone}</small></td>
                    <td>{(order.order_items || []).map(item => `${item.title} × ${item.quantity}`).join(', ')}</td>
                    <td>{money(order.total)}</td><td>{fmtDate(order.created_at)}</td>
                    <td><b>{order.payment_method === 'jazzcash' ? 'JazzCash' : order.payment_method === 'easypaisa' ? 'Easypaisa' : 'Cash on delivery'}</b>
                      <span className={`admin-order-payment admin-order-payment--${order.payment_status || 'pending'}`}>{order.payment_status || 'pending'}</span>
                      {order.payment_reference && <small>Ref: {order.payment_reference}</small>}
                      {['jazzcash', 'easypaisa'].includes(order.payment_method) && confirmation !== 'rejected' && order.payment_status !== 'paid' && order.payment_reference && <button className="admin-button admin-button--quiet" type="button" disabled={actionBusy} onClick={() => verifyOrderPayment(order)}>{actionBusy ? 'Updating…' : 'Verify payment'}</button>}
                    </td>
                    <td>
                      {confirmation === 'pending' && <div className="admin-order-actions">
                        {(order.payment_method === 'cod' || order.payment_status === 'paid') && <button className="admin-button" disabled={actionBusy} onClick={() => decideOrder(order, 'confirmed')}>{actionBusy ? 'Updating…' : 'Confirm'}</button>}
                        {order.payment_method !== 'cod' && order.payment_status !== 'paid' && <small>Verify payment before confirming.</small>}
                        <button className="admin-button admin-button--quiet" disabled={actionBusy} onClick={() => {
                          if (window.confirm(`Reject order #${order.order_number}? Its reserved stock will be returned.`)) decideOrder(order, 'rejected');
                        }}>Reject</button>
                      </div>}
                      {confirmation !== 'pending' && <select aria-label={`Fulfillment status for order ${order.order_number}`} value={order.fulfillment_status || 'unfulfilled'} disabled={actionBusy} onChange={event => updateOrderStatus(order.id, event.target.value)}>
                        {ORDER_STATUSES.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
                      </select>}
                    </td>
                  </tr>
                  {expanded && <tr className="admin-order-details"><td colSpan="7">
                    <div className="admin-order-details__grid">
                      <div><b>Delivery address</b><span>{[address.firstName, address.lastName].filter(Boolean).join(' ') || 'Name not provided'}</span><span>{address.address1 || 'Address not provided'}</span><span>{[address.city, address.zip, address.country].filter(Boolean).join(', ')}</span></div>
                      <div><b>Order items</b>{(order.order_items || []).map(item => <span key={item.id}>{item.title}{item.variant_title && item.variant_title !== 'Default Title' ? ` · ${item.variant_title}` : ''} × {item.quantity} — {money(Number(item.price) * Number(item.quantity))}</span>)}</div>
                      <div><b>Order note</b><span>{order.note || 'No note'}</span><b>Shipping / discount</b><span>{money(order.shipping)} / {money(order.discount)}</span></div>
                    </div>
                  </td></tr>}
                </Fragment>;
              })}</tbody>
            </table></div> : <div className="admin-empty">No orders match these filters. <button className="admin-text-button" type="button" onClick={() => { setOrderSearch(''); setOrderStatusFilter('all'); setOrderPaymentFilter('all'); }}>Clear filters</button></div>}
          </>}
          {!orders.length && <p className="admin-empty">No orders have been placed yet.</p>}
        </section>
      ) : (
        <section className="admin-panel admin-content-editor">
          <div className="admin-panel__heading"><div><p className="admin-eyebrow">Website</p><h2>Storefront content manager</h2><p className="admin-muted">Edit page copy, images, navigation, contact details, section order, visibility, and theme settings.</p></div></div>
          <form className="admin-content-form" onSubmit={saveWebsiteContent}>
            {false && (<>
            <section className="admin-content-group" aria-labelledby="admin-content-hero">
              <h3 id="admin-content-hero">Homepage hero</h3>
              <div className="admin-fields-row">
              <label>Hero tagline<input value={contentForm.hero.tag} onChange={event => setContentForm({ ...contentForm, hero: { ...contentForm.hero, tag: event.target.value } })} /></label>
              <label>Hero heading<input value={contentForm.hero.heading} onChange={event => setContentForm({ ...contentForm, hero: { ...contentForm.hero, heading: event.target.value } })} /></label>
              </div>
              <label>Hero description<textarea rows="3" value={contentForm.hero.lead} onChange={event => setContentForm({ ...contentForm, hero: { ...contentForm.hero, lead: event.target.value } })} /></label>
              <div className="admin-fields-row">
              <label>Hero CTA text<input value={contentForm.hero.cta} onChange={event => setContentForm({ ...contentForm, hero: { ...contentForm.hero, cta: event.target.value } })} /></label>
              <label>Secondary CTA<input value={contentForm.hero.cta2} onChange={event => setContentForm({ ...contentForm, hero: { ...contentForm.hero, cta2: event.target.value } })} /></label>
              </div>
            </section>
            <section className="admin-content-group" aria-labelledby="admin-content-offer">
              <h3 id="admin-content-offer">Promotion</h3>
              <div className="admin-fields-row">
              <label>Offer heading<input value={contentForm.offer.heading} onChange={event => setContentForm({ ...contentForm, offer: { ...contentForm.offer, heading: event.target.value } })} /></label>
              <label>Offer code<input value={contentForm.offer.code} onChange={event => setContentForm({ ...contentForm, offer: { ...contentForm.offer, code: event.target.value } })} /></label>
              </div>
              <label>Offer text<textarea rows="3" value={contentForm.offer.text} onChange={event => setContentForm({ ...contentForm, offer: { ...contentForm.offer, text: event.target.value } })} /></label>
            </section>
            <section className="admin-content-group" aria-labelledby="admin-content-footer">
              <h3 id="admin-content-footer">Footer &amp; newsletter</h3>
              <label>Footer introduction<textarea rows="3" value={contentForm.footer.about} onChange={event => setContentForm({ ...contentForm, footer: { ...contentForm.footer, about: event.target.value } })} /></label>
              <div className="admin-fields-row">
              <label>Newsletter heading<input value={contentForm.newsletter.heading} onChange={event => setContentForm({ ...contentForm, newsletter: { ...contentForm.newsletter, heading: event.target.value } })} /></label>
              <label>Newsletter text<input value={contentForm.newsletter.text} onChange={event => setContentForm({ ...contentForm, newsletter: { ...contentForm.newsletter, text: event.target.value } })} /></label>
              </div>
            </section>
            <section className="admin-content-group" aria-labelledby="admin-content-about">
              <h3 id="admin-content-about">About your brand</h3>
              <div className="admin-fields-row">
              <label>About heading<input value={contentForm.about.heading} onChange={event => setContentForm({ ...contentForm, about: { ...contentForm.about, heading: event.target.value } })} /></label>
              <label>About CTA<input value={contentForm.about.cta} onChange={event => setContentForm({ ...contentForm, about: { ...contentForm.about, cta: event.target.value } })} /></label>
              </div>
              <label>About description<textarea rows="4" value={contentForm.about.text} onChange={event => setContentForm({ ...contentForm, about: { ...contentForm.about, text: event.target.value } })} /></label>
            </section>
            </>)}
            <SiteContentEditor content={contentForm} onChange={setContentForm} onUploadImage={uploadContentImage} onUploadVideo={uploadContentVideo} disabled={busy} collections={collections} />
            <div className="admin-content-actions">
              <p>Changes are saved to Supabase and shared with every storefront visitor.</p>
              <button className="admin-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save website content'}</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
