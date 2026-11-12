'use client';
import { useState } from 'react';
import { brandVideoSource } from '../lib/brand-video.js';

export default function VideoUploadField({ video, onChange, onUpload, disabled }) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const source = brandVideoSource(video.videoFile);
  return (
    <div className="cms-control">
      <span>Brand video</span>
      <video key={source} src={source} poster={video.posterImage || undefined}
        controls muted playsInline preload="metadata" aria-label="Brand video preview"
        style={{ width: '100%', maxWidth: 640, aspectRatio: '16 / 9', objectFit: 'contain', background: '#000' }} />
      <small>{video.videoFile ? 'Uploaded video' : 'Default local video'} · MP4 or WebM, up to 50 MB</small>
      <label>
        <span>{uploading ? 'Uploading video…' : video.videoFile ? 'Replace video' : 'Upload video'}</span>
        <input type="file" accept="video/mp4,video/webm,.mp4,.webm" disabled={disabled || uploading}
          onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setUploading(true);
            setError('');
            try {
              const url = await onUpload(file);
              onChange(url);
            } catch (err) {
              setError(err.message || 'Video upload failed.');
            } finally {
              setUploading(false);
            }
          }} />
      </label>
      {video.videoFile && <button type="button" className="admin-text-button admin-text-button--danger"
        disabled={disabled || uploading} onClick={() => { onChange(''); setError(''); }}>Remove video / use default</button>}
      <small>Save website content to publish changes. Removing the video restores the local default.</small>
      {error && <small className="cms-upload-error" role="alert">{error}</small>}
    </div>
  );
}
