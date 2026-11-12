import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionTileImage, validateCollectionImage, prepareCollectionImage, COLLECTION_IMAGE_LIMIT } from '../src/lib/collection-images.js';

test('database images bind to Men, Women, Unisex and future homepage collection links', () => {
  const collections = ['men', 'women', 'unisex', 'attar'].map(handle => ({ handle, image: `https://storage.example/${handle}.webp` }));
  for (const collection of collections) {
    assert.equal(collectionTileImage(collections, `/collections/${collection.handle}?sort_by=manual`, '/old.jpg'), collection.image);
  }
  assert.equal(collectionTileImage(collections, '/collections/gift-sets'), collections[2].image);
  assert.equal(collectionTileImage([{ handle: 'gift-sets', image: '/legacy.jpg' }], '/collections/unisex'), '/legacy.jpg');
});

test('legacy images survive empty database values; replacement and explicit removal take effect', () => {
  const link = '/collections/men';
  assert.equal(collectionTileImage([], link, '/existing.jpg'), '/existing.jpg');
  assert.equal(collectionTileImage([{ handle: 'men', image: null }], link, '/existing.jpg'), '/existing.jpg');
  assert.equal(collectionTileImage([{ handle: 'men', image: '/new.webp' }], link, '/existing.jpg'), '/new.webp');
  assert.equal(collectionTileImage([{ handle: 'men', image: '' }], link, '/existing.jpg'), '');
  assert.equal(collectionTileImage([], '/collections/future'), '');
});

test('only JPG, PNG and WebP files within 10 MB are accepted', () => {
  for (const [name, type] of [['image.JPG', 'image/jpeg'], ['image.jpeg', 'image/jpeg'], ['image.png', 'image/png'], ['image.webp', 'image/webp']]) {
    assert.doesNotThrow(() => validateCollectionImage({ name, type, size: COLLECTION_IMAGE_LIMIT }));
  }
  for (const file of [
    { name: 'file.svg', type: 'image/svg+xml', size: 100 },
    { name: 'file.jpg', type: 'text/html', size: 100 },
    { name: 'file.webp', type: 'image/webp', size: 0 },
    { name: 'file.png', type: 'image/png', size: COLLECTION_IMAGE_LIMIT + 1 },
  ]) assert.throws(() => validateCollectionImage(file));
});

test('optimization preserves proportions, limits dimensions and releases decoded image memory', async t => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  t.after(() => { globalThis.createImageBitmap = originalBitmap; globalThis.document = originalDocument; });
  let closed = false;
  const canvas = {
    getContext() { return { drawImage(bitmap, x, y, width, height) { assert.equal(width, 800); assert.equal(height, 1600); } }; },
    toBlob(callback, type, quality) { assert.equal(type, 'image/webp'); assert.equal(quality, 0.85); callback(new Blob(['optimized'], { type })); },
  };
  globalThis.createImageBitmap = async () => ({ width: 2000, height: 4000, close() { closed = true; } });
  globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } };
  const result = await prepareCollectionImage(new File(['image-data'], 'collection.jpg', { type: 'image/jpeg' }));
  assert.equal(result.name, 'collection.webp');
  assert.equal(result.type, 'image/webp');
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 1600);
  assert.equal(closed, true);
});

test('corrupt images fail before any upload', async t => {
  const original = globalThis.createImageBitmap;
  t.after(() => { globalThis.createImageBitmap = original; });
  globalThis.createImageBitmap = async () => { throw new Error('decode failed'); };
  await assert.rejects(prepareCollectionImage(new File(['corrupt'], 'bad.jpg', { type: 'image/jpeg' })), /could not be opened/);
});
