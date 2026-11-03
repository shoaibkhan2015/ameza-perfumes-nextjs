const NOTE_ICONS = {
  grapefruit: 'grapefruit', lemon: 'lemon', mint: 'mint', marine: 'marine',
  lavender: 'lavender', ginger: 'ginger', guaiac: 'guaiac', cedar: 'cedar',
  cedarwood: 'cedar', musk: 'musk', amber: 'amber', jasmine: 'jasmine',
  oud: 'oud', rose: 'rose', vanilla: 'vanilla',
};

const GROUPS = [
  ['topNotes', 'top_notes', 'Top Notes'],
  ['heartNotes', 'heart_notes', 'Middle Notes'],
  ['baseNotes', 'base_notes', 'Base Notes'],
];

const noteKey = name => {
  const normalized = String(name).toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.startsWith('white')) return 'musk';
  const match = Object.keys(NOTE_ICONS).find(key => normalized.includes(key));
  return match ? NOTE_ICONS[match] : 'amber';
};

const parseNoteNames = value => String(value || '')
  .split(/[,;\n]+/)
  .map(name => name.trim())
  .filter(Boolean);

export function getProductNoteRows(fragrance = {}, profile, fallbackNotes = []) {
  const hasSavedNoteFields = GROUPS.some(([camel, snake]) =>
    Object.hasOwn(fragrance, camel) || Object.hasOwn(fragrance, snake));

  if (hasSavedNoteFields) {
    const knownNotes = [
      ...(Array.isArray(fragrance.notes) ? fragrance.notes : []),
      ...(Array.isArray(profile?.notes) ? profile.notes : []),
    ];
    return GROUPS.flatMap(([camel, snake, group]) => {
      const value = Object.hasOwn(fragrance, camel) ? fragrance[camel] : fragrance[snake];
      return parseNoteNames(value).map(name => {
        const existing = knownNotes.find(note =>
          note?.group === group && String(note.name || '').toLowerCase() === name.toLowerCase());
        return { group, name, key: existing?.key || noteKey(name), pct: existing?.pct ?? 70 };
      });
    });
  }

  if (Array.isArray(fragrance.notes)) return fragrance.notes;
  if (Array.isArray(profile?.notes)) return profile.notes;
  return Array.isArray(fallbackNotes) ? fallbackNotes : [];
}
