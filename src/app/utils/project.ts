import type { WorkType } from '../data/projects';
import type { Translations } from '../context/LanguageContext';

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
