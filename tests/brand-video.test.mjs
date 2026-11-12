import test from 'node:test';
import assert from 'node:assert/strict';
import { brandVideoSource, DEFAULT_BRAND_VIDEO, MAX_VIDEO_BYTES, uploadBrandVideo, validateVideo, VIDEO_BUCKET } from '../src/lib/brand-video.js';

test('missing or removed admin video uses the local MP4; uploaded source takes priority', () => {
  for (const value of [undefined, null, '', '   ']) assert.equal(brandVideoSource(value), DEFAULT_BRAND_VIDEO);
  assert.equal(brandVideoSource(' https://storage.example/film.webm '), 'https://storage.example/film.webm');
});

test('only non-empty MP4/WebM uploads within the storage limit are accepted', () => {
  assert.equal(validateVideo({ name: 'Film.MP4', type: 'video/mp4', size: 100 }), 'video/mp4');
  assert.equal(validateVideo({ name: 'film.webm', type: '', size: MAX_VIDEO_BYTES }), 'video/webm');
  for (const file of [
    { name: 'film.mov', type: 'video/quicktime', size: 100 },
    { name: 'film.mp4', type: 'text/html', size: 100 },
    { name: 'film.mp4', type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 },
    { name: 'film.webm', type: 'video/webm', size: 0 },
  ]) assert.throws(() => validateVideo(file));
});

test('replacement uploads get unique cloud paths and public URLs without overwriting the live video', async () => {
  const paths = [];
  const storage = { from(bucket) {
    assert.equal(bucket, VIDEO_BUCKET);
    return {
      async upload(path, file, options) {
        paths.push(path);
        assert.match(path, /^site-content\/admin-id\/[\w-]+-brand-film.mp4$/);
        assert.equal(file.size, 100);
        assert.equal(options.contentType, 'video/mp4');
        assert.notEqual(options.upsert, true);
        return { error: null };
      },
      getPublicUrl(path) { return { data: { publicUrl: `https://storage.example/${path}` } }; },
    };
  } };
  const file = { name: 'brand film.mp4', type: 'video/mp4', size: 100 };
  const first = await uploadBrandVideo(storage, 'admin-id', file);
  const second = await uploadBrandVideo(storage, 'admin-id', file);
  assert.notEqual(first, second);
  assert.equal(new Set(paths).size, 2);
});

test('storage errors cannot produce a replacement URL; invalid uploads never reach storage', async () => {
  const file = { name: 'brand.mp4', type: 'video/mp4', size: 100 };
  const storage = { from() { return {
    async upload() { return { error: new Error('Permission denied') }; },
    getPublicUrl() { assert.fail('Failed uploads must not replace the current video'); },
  }; } };
  await assert.rejects(uploadBrandVideo(storage, 'admin-id', file), /Permission denied/);
  await assert.rejects(uploadBrandVideo(null, 'admin-id', { ...file, size: 0 }), /non-empty/);
  await assert.rejects(uploadBrandVideo(null, '', file), /Sign in/);
});
