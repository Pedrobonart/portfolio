import type { Localized, WorkType } from '../data/projects';
import type { Language, Translations } from '../context/LanguageContext';

/**
 * Pick a localized value. Plain strings/arrays are returned as-is. Objects
 * with `{ en, es }` resolve by `lang`, falling back to `en` when the
 * Spanish value is missing or empty.
 */
export function pickL<T>(value: Localized<T>, lang: Language): T {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'en' in value) {
    const v = value as { en: T; es?: T };
    if (lang === 'es' && v.es != null && v.es !== ('' as unknown as T)) return v.es;
    return v.en;
  }
  return value as T;
}

/** Returns the CSS variable for a project's accent colour. */
export function typeColor(type: 'architecture' | 'cartography'): string {
  return type === 'architecture' ? 'var(--site-arch)' : 'var(--site-carto)';
}

/** Returns the human-readable work-type label from translations. */
export function workTypeLabel(workType: WorkType, t: Translations): string {
  if (workType === 'professional') return t.detail.workTypeProfessional;
  if (workType === 'academic') return t.detail.workTypeAcademic;
  return t.detail.workTypeThesis;
}
