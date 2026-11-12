'use client';
import { useState } from 'react';
import VideoUploadField from './VideoUploadField.jsx';

const GROUPS = [
  { label: 'Store details', fields: [['site', 'Brand & contact details']] },
  { label: 'Global layout', fields: [['layoutSettings', 'Header, footer & floating controls']] },
  { label: 'Navigation', fields: [['mainMenu', 'Main navigation']] },
  { label: 'Announcement', fields: [['announcement', 'Announcement bar']] },
  { label: 'Homepage hero', fields: [['hero', 'Hero content & images']] },
  { label: 'Homepage sections', fields: [['home', 'Section order, visibility & product rails']] },
  { label: 'Collection tiles', fields: [['tiles', 'Homepage collection cards']] },
  { label: 'Mood finder', fields: [['moods', 'Mood picker choices']] },
  { label: 'Mood heading', fields: [['moodSection', 'Mood finder section heading']] },
  { label: 'Trust messages', fields: [['trust', 'Store benefits strip']] },
  { label: 'Promotion', fields: [['offer', 'Offer banner']] },
  { label: 'Reviews', fields: [['reviews', 'Customer reviews']] },
  { label: 'FAQs', fields: [['faqSection', 'FAQ heading'], ['faq', 'Questions & answers']] },
  { label: 'Newsletter', fields: [['newsletter', 'Newsletter content']] },
  { label: 'Brand film', fields: [['video', 'Video & side copy']] },
  { label: 'About page', fields: [['pageSections', 'About/contact page sections'], ['about', 'About content'], ['values', 'Brand values']] },
  { label: 'Contact page', fields: [['contactSection', 'Contact form labels'], ['contact', 'Contact details']] },
  { label: 'Product page', fields: [['pageSections', 'Product page sections'], ['pdp', 'Product page details'], ['pdpReviews', 'Product reviews']] },
  { label: 'Footer', fields: [['footer', 'Footer content & social links'], ['footerMenu', 'Footer links']] },
  { label: 'Theme & layout', fields: [['appearance', 'Colors & layout']] },
];

const labelize = value => String(value)
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase());
const clone = value => JSON.parse(JSON.stringify(value));
const isImageField = key => /(^image$|image$|logo|poster|bottle)/i.test(key);
const isLongText = (key, value) => /text|description|caption|quote|note|excerpt|content|prooflist|story|heading/i.test(key)
  || String(value).includes('\n') || String(value).length > 120;
const getItemLabel = (item, index) => {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    return item.title || item.name || item.heading || item.label || item.platform || item.key || `Item ${index + 1}`;
  }
  return `Item ${index + 1}`;
};
const ORDER_OPTIONS = {
  home: { hero: 'Homepage hero', trust: 'Trust messages', tiles: 'Collection tiles', moods: 'Mood finder', bestsellers: 'Bestsellers', offer: 'Promotion', video: 'Brand film', newArrivals: 'New arrivals', reviews: 'Customer reviews', faq: 'FAQs', newsletter: 'Newsletter' },
  pageSections: { about: 'About section', values: 'Brand values', video: 'Brand film', reviews: 'Reviews', newsletter: 'Newsletter', contact: 'Contact information', faq: 'FAQs', main: 'Product details', story: 'Product story', recommendations: 'Recommendations' },
};

function updateAtPath(source, path, value) {
  if (!path.length) return value;
  const [key, ...rest] = path;
  if (Array.isArray(source)) {
    return source.map((item, index) => index === key ? updateAtPath(item, rest, value) : item);
  }
  return { ...source, [key]: updateAtPath(source?.[key], rest, value) };
}

function ContentField({ name, value, path, onChange, onUploadImage, disabled, depth = 0, collections = [] }) {
  const [uploadError, setUploadError] = useState('');
  if (Array.isArray(value)) {
    return (
      <details className="cms-field cms-array" open={depth === 0}>
        <summary>{labelize(name)} <span>{value.length} items</span></summary>
        <div className="cms-array__items">
          {value.map((item, index) => (
            <details className="cms-array__item" key={index} open={depth === 0 && value.length < 4}>
              <summary>{getItemLabel(item, index)}</summary>
              <div className="cms-field-grid">
                <ContentField name={`${labelize(name)} item ${index + 1}`} value={item} path={[...path, index]} onChange={onChange} onUploadImage={onUploadImage} disabled={disabled} depth={depth + 1} collections={collections} />
                <div className="cms-array__actions">
                  <button type="button" className="admin-text-button" disabled={disabled || index === 0} onClick={() => {
                    const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(path, next);
                  }}>Move up</button>
                  <button type="button" className="admin-text-button" disabled={disabled || index === value.length - 1} onClick={() => {
                    const next = [...value]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(path, next);
                  }}>Move down</button>
                  <button type="button" className="admin-text-button admin-text-button--danger" disabled={disabled} onClick={() => onChange(path, value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                </div>
              </div>
            </details>
          ))}
          <button type="button" className="admin-text-button cms-add-item" disabled={disabled} onClick={() => {
            const template = value.length ? clone(value[value.length - 1]) : '';
            onChange(path, [...value, template]);
          }}>+ Add {labelize(name).replace(/s$/, '')}</button>
        </div>
      </details>
    );
  }

  if (value && typeof value === 'object') {
    return (
      <details className="cms-field cms-object" open={depth === 0}>
        <summary>{labelize(name)}</summary>
        <div className="cms-field-grid">
          {Object.entries(value).map(([key, child]) => (
            <ContentField key={key} name={key} value={child} path={[...path, key]} onChange={onChange} onUploadImage={onUploadImage} disabled={disabled} depth={depth + 1} collections={collections} />
          ))}
        </div>
      </details>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <label className="cms-toggle">
        <input type="checkbox" checked={value} disabled={disabled} onChange={event => onChange(path, event.target.checked)} />
        <span>{labelize(name)}</span>
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="cms-control">
        <span>{labelize(name)}</span>
        <input type="number" value={value} disabled={disabled} onChange={event => onChange(path, event.target.value === '' ? 0 : Number(event.target.value))} />
      </label>
    );
  }

  const stringValue = value == null ? '' : String(value);
  const colorField = /^#[\da-f]{6}$/i.test(stringValue) || /color|^c[12]$|glow/i.test(name);
  const imageField = isImageField(name);
  const orderIndex = path.findIndex(key => typeof key === 'string' && key.endsWith('Order'));
  const orderOptions = orderIndex > 0 ? ORDER_OPTIONS[path[orderIndex - 1]] || {} : null;

  return (
    <label className={`cms-control${imageField ? ' cms-control--image' : ''}`}>
      <span>{labelize(name)}</span>
      {orderOptions ? (
        <select value={stringValue} disabled={disabled} onChange={event => onChange(path, event.target.value)}>
          <option value="">Choose a section</option>
          {Object.entries(orderOptions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      ) : name.toLowerCase() === 'collection' && collections.length ? (
        <select value={stringValue} disabled={disabled} onChange={event => onChange(path, event.target.value)}>
          <option value="all">All products</option>
          {collections.map(collection => <option key={collection.handle} value={collection.handle}>{collection.title}</option>)}
        </select>
      ) : colorField ? (
        <span className="cms-color-control">
          <input type="color" value={/^#[\da-f]{6}$/i.test(stringValue) ? stringValue : '#000000'} disabled={disabled} onChange={event => onChange(path, event.target.value)} />
          <input type="text" value={stringValue} disabled={disabled} onChange={event => onChange(path, event.target.value)} />
        </span>
      ) : isLongText(name, stringValue) ? (
        <textarea rows={Math.min(7, Math.max(3, stringValue.split('\n').length + 1))} value={stringValue} disabled={disabled} onChange={event => onChange(path, event.target.value)} />
      ) : (
        <input type="text" value={stringValue} disabled={disabled} onChange={event => onChange(path, event.target.value)} />
      )}
      {imageField && (
        <span className="cms-image-control">
          {stringValue && <img src={stringValue} alt={`${labelize(name)} preview`} />}
          <input
            type="file"
            accept="image/*"
            aria-label={`Upload ${labelize(name)}`}
            disabled={disabled}
            onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              try {
                const url = await onUploadImage(file);
                onChange(path, url);
                setUploadError('');
              } catch (error) {
                setUploadError(error?.message || 'Image upload failed.');
              }
            }}
          />
          {uploadError && <small className="cms-upload-error" role="alert">{uploadError}</small>}
        </span>
      )}
    </label>
  );
}

export default function SiteContentEditor({ content, onChange, onUploadImage, onUploadVideo, disabled, collections = [] }) {
  const [activeGroup, setActiveGroup] = useState(0);
  const group = GROUPS[activeGroup];

  function changeValue(path, value) {
    onChange(current => updateAtPath(current, path, value));
  }

  return (
    <div className="cms-editor">
      <nav className="cms-editor__nav" aria-label="Website content categories">
        {GROUPS.map((item, index) => (
          <button key={item.label} type="button" className={index === activeGroup ? 'is-active' : ''} onClick={() => setActiveGroup(index)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="cms-editor__content">
        <div className="admin-panel__heading">
          <div><p className="admin-eyebrow">Edit storefront</p><h3>{group.label}</h3></div>
          <span className="admin-muted">Changes are shared with all visitors</span>
        </div>
        {group.fields.map(([key, title]) => (
          <section className="cms-editor__section" key={key}>
            <h4>{title}</h4>
            {key === 'video' && <VideoUploadField video={content.video} onChange={url => changeValue(['video', 'videoFile'], url)} onUpload={onUploadVideo} disabled={disabled} />}
            <ContentField name={title} value={key === 'video' ? Object.fromEntries(Object.entries(content.video).filter(([field]) => !['videoUrl', 'videoFile'].includes(field))) : content[key]} path={[key]} onChange={changeValue} onUploadImage={onUploadImage} disabled={disabled} collections={collections} />
          </section>
        ))}
      </div>
    </div>
  );
}
