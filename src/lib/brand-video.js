export const DEFAULT_BRAND_VIDEO = '/videos/ameza-brand.mp4';
export const VIDEO_BUCKET = 'ameza-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function brandVideoSource(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_BRAND_VIDEO;
}

export function validateVideo(file) {
  const types = { mp4: 'video/mp4', webm: 'video/webm' };
  const extension = file.name.split('.').pop().toLowerCase();
  const contentType = types[extension];
  if (!contentType || (file.type && file.type !== contentType)) {
    throw new Error('Choose an MP4 or WebM video.');
  }
  if (!file.size || file.size > MAX_VIDEO_BYTES) {
    throw new Error('Videos must be non-empty and no larger than 50 MB.');
  }
  return contentType;
}

export async function uploadBrandVideo(storage, userId, file) {
  const contentType = validateVideo(file);
  if (!userId) throw new Error('Sign in as an admin to upload a video.');
  const safeName = file.name.replace(/[^\w.-]+/g, '-');
  const path = `site-content/${userId}/${crypto.randomUUID()}-${safeName}`;
  const bucket = storage.from(VIDEO_BUCKET);
  const { error } = await bucket.upload(path, file, { contentType, cacheControl: '31536000' });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
