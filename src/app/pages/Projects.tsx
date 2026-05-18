import { useState } from 'react';
import { useNavigate } from 'react-router';
import { projects, ProjectType } from '../data/projects';
import { MapPin, ArrowRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { pickL, typeColor, workTypeLabel } from '../utils/project';
import type { Localized } from '../data/projects';

type Filter = 'all' | ProjectType;

export function Projects() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const { t, language } = useLanguage();
  const L = <T,>(v: Localized<T>) => pickL<T>(v, language);

  const filtered = projects.filter(
    (p) => filter === 'all' || p.type === filter
  );

  const byYear = filtered.reduce<Record<number, typeof filtered>>(
    (acc, project) => {
      if (!acc[project.year]) acc[project.year] = [];
      acc[project.year].push(project);
      return acc;
    },
    {}
  );
  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  const filterOptions: { value: Filter; label: string }[] = [
    { value: 'all', label: t.projects.all },
    { value: 'architecture', label: t.projects.architecture },
    { value: 'cartography', label: t.projects.cartography },
  ];

  // Work-type badge colour: professional is muted, thesis uses arch accent,
  // academic uses carto accent.
  const workTypeBadgeColor = (wt: string) => {
    if (wt === 'professional') return 'var(--site-muted)';
    if (wt === 'thesis') return 'var(--site-arch)';
    return 'var(--site-carto)';
  };

  return (
    <div
      className="min-h-screen pt-16"
      style={{ background: 'var(--site-bg)' }}
    >
      {/* Header */}
      <div
        className="px-8 md:px-16 pt-16 pb-10"
        style={{ borderBottom: '1px solid var(--site-border)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p
              className="tracking-[0.2em] uppercase mb-3"
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-sans)',
                color: 'var(--site-muted)',
              }}
            >
              {t.projects.selectedWork}
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2.8rem',
                fontWeight: 400,
                lineHeight: 1.15,
                color: 'var(--site-text)',
              }}
            >
              {t.projects.title}
            </h1>
          </div>

          {/* Filter */}
          <div
            className="flex items-center gap-1 p-1"
            style={{
              background: 'var(--site-surface)',
              border: '1px solid var(--site-border)',
            }}
          >
            {filterOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className="px-4 py-2 tracking-[0.08em] uppercase transition-all duration-200"
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-sans)',
                  background: filter === value ? 'var(--site-text)' : 'transparent',
                  color: filter === value ? 'var(--site-bg)' : 'var(--site-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Project List */}
      <div className="px-8 md:px-16 py-12 max-w-5xl mx-auto">
        {sortedYears.map((year, yearIdx) => (
          <div key={year} className="mb-16">
            {/* Year heading */}
            <div className="flex items-center gap-6 mb-8">
              <span
                className="tracking-[0.1em]"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--site-text)',
                }}
              >
                {year}
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--site-border)' }}
              />
            </div>

            {/* Projects in this year */}
            <div className="flex flex-col gap-px">
              {byYear[year].map((project, idx) => (
                <div
                  key={project.id}
                  style={{
                    opacity: 0,
                    animation: 'pageFadeIn 0.35s ease forwards',
                    animationDelay: `${yearIdx * 50 + idx * 70}ms`,
                  }}
                >
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full group flex items-stretch transition-all duration-300 text-left"
                    style={{
                      minHeight: 110,
                      border: '1px solid var(--site-border)',
                      background: 'var(--site-surface)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--site-text)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--site-border)';
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="shrink-0 overflow-hidden"
                      style={{ width: 140 }}
                    >
                      <img
                        src={project.image}
                        alt={L(project.title)}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center px-6 py-4 gap-6">
                      <div className="flex-1">
                        {/* Type badge */}
                        <span
                          className="tracking-[0.15em] uppercase block mb-2"
                          style={{
                            fontSize: '0.6rem',
                            fontFamily: 'var(--font-sans)',
                            color: typeColor(project.type),
                            fontWeight: 500,
                          }}
                        >
                          {project.type === 'architecture'
                            ? t.projects.architecture
                            : t.projects.cartography}
                        </span>

                        <h2
                          className="mb-2 transition-colors"
                          style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: '1.25rem',
                            fontWeight: 400,
                            lineHeight: 1.25,
                            color: 'var(--site-text)',
                          }}
                        >
                          {L(project.title)}
                        </h2>

                        <div
                          className="flex items-center gap-1.5"
                          style={{ color: 'var(--site-muted)' }}
                        >
                          <MapPin size={10} strokeWidth={1.5} />
                          <span
                            className="tracking-[0.05em]"
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'var(--font-sans)',
                            }}
                          >
                            {L(project.location)}, {L(project.country)}
                          </span>
                        </div>
                      </div>

                      {/* Short desc (hidden on mobile) */}
                      <div
                        className="hidden md:block flex-1 overflow-hidden"
                        style={{ maxWidth: '36ch' }}
                      >
                        <p
                          className="line-clamp-3"
                          style={{
                            fontSize: '0.78rem',
                            fontFamily: 'var(--font-sans)',
                            lineHeight: 1.65,
                            color: 'var(--site-muted)',
                          }}
                        >
                          {L(project.shortDescription)}
                        </p>
                      </div>

                      {/* Work type + arrow */}
                      <div className="flex flex-col items-end gap-3 ml-4 shrink-0">
                        <span
                          className="tracking-[0.12em] uppercase"
                          style={{
                            fontSize: '0.6rem',
                            fontFamily: 'var(--font-sans)',
                            color: workTypeBadgeColor(project.workType),
                          }}
                        >
                          {workTypeLabel(project.workType, t)}
                        </span>
                        <ArrowRight
                          size={14}
                          strokeWidth={1.5}
                          className="opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-300"
                          style={{ color: 'var(--site-text)' }}
                        />
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div
            className="text-center py-24"
            style={{
              fontFamily: 'var(--font-sans)',
              color: 'var(--site-muted)',
            }}
          >
            {t.projects.noProjects}
          </div>
        )}
      </div>
    </div>
  );
}
