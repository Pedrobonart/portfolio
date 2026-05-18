import { useParams, useNavigate, Link } from 'react-router';
import { type ReactNode } from 'react';
import { projects } from '../data/projects';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Activity,
  Square,
  Map,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { pickL, typeColor, workTypeLabel } from '../utils/project';
import { LayoutBlocks, MediaBlocks } from '../components/MediaBlocks';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const { t, language } = useLanguage();
  // Short alias — applied to every Localized<string> read below.
  const L = <T,>(v: import('../data/projects').Localized<T>) => pickL<T>(v, language);

  // Always navigate to /projects — reliable regardless of browser history state
  const handleBack = () => {
    navigate('/projects');
  };

  if (!project) {
    return (
      <div
        className="min-h-screen flex items-center justify-center pt-16"
        style={{ background: 'var(--site-bg)' }}
      >
        <div className="text-center">
          <p
            className="mb-6"
            style={{ fontFamily: 'var(--font-sans)', color: 'var(--site-muted)' }}
          >
            {t.detail.projectNotFound}
          </p>
          <Link
            to="/projects"
            className="underline underline-offset-4"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.85rem',
              color: 'var(--site-text)',
            }}
          >
            {t.detail.backToProjects}
          </Link>
        </div>
      </div>
    );
  }

  const otherProjects = projects
    .filter((p) => p.id !== project.id && p.type === project.type)
    .slice(0, 2);

  const accentColor = typeColor(project.type);

  return (
    <div
      className="min-h-screen pt-16"
      style={{ background: 'var(--site-bg)' }}
    >
      {/* Back nav */}
      <div className="px-8 md:px-16 pt-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 group transition-colors duration-200"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.78rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--site-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--site-text)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--site-muted)';
          }}
        >
          <ArrowLeft
            size={14}
            strokeWidth={1.5}
            className="group-hover:-translate-x-0.5 transition-transform duration-200"
          />
          <span className="tracking-[0.08em] uppercase">{t.detail.back}</span>
        </button>
      </div>

      {/* Hero Image */}
      <div
        className="mt-8 px-8 md:px-16"
        style={{ opacity: 0, animation: 'pageFadeIn 0.5s ease forwards' }}
      >
        <div
          className="w-full overflow-hidden"
          style={{
            height: 'clamp(300px, 52vh, 560px)',
            background: 'var(--site-surface2)',
          }}
        >
          <img
            src={project.image}
            alt={L(project.title)}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Media blocks placed in the 'afterHero' slot (the default). */}
      {project.media && (
        <div
          className="mt-10 px-8 md:px-16 max-w-6xl mx-auto"
          style={{ opacity: 0, animation: 'pageFadeIn 0.5s ease 0.1s forwards' }}
        >
          <MediaBlocks blocks={project.media} slot="afterHero" />
        </div>
      )}

      {/* Main Content */}
      <div className="px-8 md:px-16 mt-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
          {/* Left: Metadata */}
          <aside
            className="md:col-span-1"
            style={{ opacity: 0, animation: 'pageFadeIn 0.45s ease 0.1s forwards' }}
          >
            {/* Type */}
            <div className="mb-8">
              <span
                className="tracking-[0.18em] uppercase"
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-sans)',
                  color: accentColor,
                  fontWeight: 500,
                }}
              >
                {project.type === 'architecture'
                  ? t.projects.architecture
                  : t.projects.cartography}
              </span>
            </div>

            {/* Metadata grid */}
            <div className="flex flex-col gap-5">
              <MetaItem
                icon={<Calendar size={12} strokeWidth={1.5} />}
                label={t.detail.year}
                value={String(project.year)}
              />
              <MetaItem
                icon={<MapPin size={12} strokeWidth={1.5} />}
                label={t.detail.location}
                value={`${L(project.location)}, ${L(project.country)}`}
              />
              <MetaItem
                icon={<User size={12} strokeWidth={1.5} />}
                label={t.detail.client}
                value={L(project.client)}
              />
              <MetaItem
                icon={<Activity size={12} strokeWidth={1.5} />}
                label={t.detail.workType}
                value={workTypeLabel(project.workType, t)}
              />
              {project.area && (
                <MetaItem
                  icon={<Square size={12} strokeWidth={1.5} />}
                  label={t.detail.area}
                  value={L(project.area)}
                />
              )}
              {project.scale && (
                <MetaItem
                  icon={<Map size={12} strokeWidth={1.5} />}
                  label={t.detail.scale}
                  value={L(project.scale)}
                />
              )}
            </div>

            {/* Tags */}
            <div className="mt-10">
              <p
                className="tracking-[0.15em] uppercase mb-3"
                style={{
                  fontSize: '0.6rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--site-muted)',
                }}
              >
                {t.detail.tags}
              </p>
              <div className="flex flex-wrap gap-2">
                {L(project.tags).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1"
                    style={{
                      border: '1px solid var(--site-border)',
                      fontSize: '0.62rem',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.08em',
                      color: 'var(--site-muted)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Coordinates */}
            <div
              className="mt-10 p-4"
              style={{
                background: 'var(--site-surface2)',
                border: '1px solid var(--site-border)',
              }}
            >
              <p
                className="tracking-[0.15em] uppercase mb-2"
                style={{
                  fontSize: '0.6rem',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--site-muted)',
                }}
              >
                {t.detail.coordinates}
              </p>

              {project.extraLocations?.length ? (
                // Multiple locations
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: undefined, coordinates: project.coordinates },
                    ...project.extraLocations,
                  ].map((loc, i) => (
                    <div key={i}>
                      {loc.label && (
                        <p
                          className="tracking-[0.1em] uppercase mb-1"
                          style={{
                            fontSize: '0.58rem',
                            fontFamily: 'var(--font-sans)',
                            color: 'var(--site-muted)',
                          }}
                        >
                          {loc.label}
                        </p>
                      )}
                      <CoordinateDisplay coordinates={loc.coordinates} />
                    </div>
                  ))}
                </div>
              ) : (
                // Single location
                <CoordinateDisplay coordinates={project.coordinates} />
              )}
            </div>
          </aside>

          {/* Right: Title + Description */}
          <div
            className="md:col-span-2"
            style={{ opacity: 0, animation: 'pageFadeIn 0.45s ease 0.15s forwards' }}
          >
            <h1
              className="mb-8"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 400,
                lineHeight: 1.15,
                color: 'var(--site-text)',
              }}
            >
              {L(project.title)}
            </h1>

            {/* Divider */}
            <div
              className="w-12 h-px mb-8"
              style={{ background: 'var(--site-text)' }}
            />

            {/* Body: either custom layout, or default description/details
                with slotted media in between. */}
            {project.layout && project.layout.length > 0 ? (
              <LayoutBlocks
                blocks={project.layout}
                description={L(project.description)}
                details={L(project.details)}
              />
            ) : (
              <div className="space-y-6">
                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.95rem',
                    lineHeight: 1.8,
                    color: 'var(--site-text2)',
                  }}
                >
                  {L(project.description)}
                </p>

                {/* Slot: afterDescription */}
                {project.media && (
                  <MediaBlocks blocks={project.media} slot="afterDescription" />
                )}

                <p
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.88rem',
                    lineHeight: 1.85,
                    color: 'var(--site-muted)',
                  }}
                >
                  {L(project.details)}
                </p>

                {/* Slot: afterDetails */}
                {project.media && (
                  <MediaBlocks blocks={project.media} slot="afterDetails" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slot: beforeRelated — full-width row before related-projects section. */}
      {project.media && (
        <div className="mt-16 px-8 md:px-16 max-w-6xl mx-auto">
          <MediaBlocks blocks={project.media} slot="beforeRelated" />
        </div>
      )}

      {/* Related Projects */}
      {otherProjects.length > 0 && (
        <div
          className="px-8 md:px-16 mt-24 pb-20 pt-16 max-w-6xl mx-auto"
          style={{ borderTop: '1px solid var(--site-border)' }}
        >
          <p
            className="tracking-[0.2em] uppercase mb-8"
            style={{
              fontSize: '0.65rem',
              fontFamily: 'var(--font-sans)',
              color: 'var(--site-muted)',
            }}
          >
            {t.detail.relatedProjects}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {otherProjects.map((related) => (
              <button
                key={related.id}
                onClick={() => navigate(`/projects/${related.id}`)}
                className="group flex gap-5 items-stretch text-left transition-all duration-300"
                style={{
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
                <div
                  className="shrink-0 overflow-hidden"
                  style={{ width: 100 }}
                >
                  <img
                    src={related.image}
                    alt={L(related.title)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 p-4">
                  <span
                    className="block tracking-[0.15em] uppercase mb-1.5"
                    style={{
                      fontSize: '0.58rem',
                      fontFamily: 'var(--font-sans)',
                      color: accentColor,
                      fontWeight: 500,
                    }}
                  >
                    {related.type === 'architecture'
                      ? t.projects.architecture
                      : t.projects.cartography}
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.05rem',
                      fontWeight: 400,
                      lineHeight: 1.3,
                      color: 'var(--site-text)',
                    }}
                  >
                    {L(related.title)}
                  </p>
                  <p
                    className="mt-1"
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--site-muted)',
                    }}
                  >
                    {related.year} · {L(related.location)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CoordinateDisplay({ coordinates }: { coordinates: [number, number] }) {
  const [lat, lng] = coordinates;
  return (
    <p
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.75rem',
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--site-text)',
      }}
    >
      {lat.toFixed(4)}° N
      <br />
      {Math.abs(lng).toFixed(4)}° {lng >= 0 ? 'E' : 'W'}
    </p>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 mb-1"
        style={{ color: 'var(--site-muted)' }}
      >
        {icon}
        <span
          className="tracking-[0.12em] uppercase"
          style={{ fontSize: '0.6rem', fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </span>
      </div>
      <p
        style={{
          fontSize: '0.82rem',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.5,
          color: 'var(--site-text)',
        }}
      >
        {value}
      </p>
    </div>
  );
}
