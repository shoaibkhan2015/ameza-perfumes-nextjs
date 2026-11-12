export const COLLECTION_IMAGE_LIMIT = 10 * 1024 * 1024;

export function validateCollectionImage(file) {
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const type = types[file.name.split('.').pop().toLowerCase()];
  if (!type || (file.type && file.type !== type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (!file.size || file.size > COLLECTION_IMAGE_LIMIT) throw new Error('Choose a non-empty image no larger than 10 MB.');
}

// Decode before uploading; resize large images without changing their aspect ratio.
export async function prepareCollectionImage(file) {
  validateCollectionImage(file);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Choose a valid JPG, PNG, or WebP file.');
  }
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('Image optimization failed. Please try another image.');
    if (ratio === 1 && blob.size >= file.size && file.type) return file;
    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export function collectionTileImage(collections, link, legacyImage = '') {
  const handle = String(link || '').split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop();
  const collection = collections.find(item => item.handle === handle)
    || (handle === 'gift-sets' ? collections.find(item => item.handle === 'unisex') : undefined)
    || (handle === 'unisex' ? collections.find(item => item.handle === 'gift-sets') : undefined);
  // Empty string records explicit removal; null retains legacy homepage artwork.
  return collection?.image === '' ? '' : collection?.image || legacyImage;
}
