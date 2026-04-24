import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Globe3D } from '../components/Globe3D';
import { projects } from '../data/projects';

// Background is always space-dark; globe style follows the theme toggle.
const SPACE_BG = '#04060f';

export function Landing() {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{ background: SPACE_BG }}
    >
      {/* 3D Globe — space background always, map style follows theme */}
      <Globe3D isDark={isDark} />

      {/* Top gradient overlay for nav readability */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none z-[1000]"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, transparent 100%)',
        }}
      />

      {/* Bottom gradient fades into space bg */}
      <div
        className="absolute bottom-0 left-0 right-0 h-44 pointer-events-none z-[1000]"
        style={{
          background: `linear-gradient(to top, ${SPACE_BG} 0%, rgba(4,6,15,0.5) 60%, transparent 100%)`,
        }}
      />

      {/* Hero text (bottom-left) */}
      <div className="absolute bottom-12 left-8 z-[1000] pointer-events-none">
        <p
          className="tracking-[0.2em] uppercase mb-2"
          style={{
            fontSize: '0.62rem',
            fontFamily: 'var(--font-sans)',
            color: 'rgba(180,195,220,0.55)',
          }}
        >
          {t.landing.subtitle}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.8rem, 3vw, 2.5rem)',
            fontWeight: 400,
            lineHeight: 1.15,
            color: '#dde4f0',
          }}
        >
          {t.landing.title1}
          <br />
          {t.landing.title2}
        </h1>
      </div>

      {/* Legend (bottom-right) — colours follow theme */}
      <div
        className="absolute bottom-10 right-5 z-[1000] px-5 py-4 flex flex-col gap-3"
        style={{
          background: isDark ? 'rgba(8,13,28,0.88)' : 'rgba(245,240,232,0.88)',
          backdropFilter: 'blur(6px)',
          border: isDark ? '1px solid rgba(30,45,80,0.7)' : '1px solid rgba(160,140,110,0.45)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 10,
              height: 10,
              background: isDark ? '#D4904A' : '#c07830',
              transform: 'rotate(45deg)',
              flexShrink: 0,
              boxShadow: isDark
                ? '0 0 0 1.5px rgba(8,13,28,0.8), 0 0 0 2.5px #D4904A'
                : '0 0 0 1.5px rgba(245,240,232,0.8), 0 0 0 2.5px #c07830',
            }}
          />
          <span
            className="tracking-[0.1em] uppercase"
            style={{ fontSize: '0.62rem', fontFamily: 'var(--font-sans)', color: isDark ? '#dde4f0' : '#3a2e1e' }}
          >
            {t.landing.arch}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isDark ? '#5A9FC4' : '#2a6e9a',
              flexShrink: 0,
              boxShadow: isDark
                ? '0 0 0 2px rgba(8,13,28,0.8), 0 0 0 3.5px #5A9FC4'
                : '0 0 0 2px rgba(245,240,232,0.8), 0 0 0 3.5px #2a6e9a',
            }}
          />
          <span
            className="tracking-[0.1em] uppercase"
            style={{ fontSize: '0.62rem', fontFamily: 'var(--font-sans)', color: isDark ? '#dde4f0' : '#3a2e1e' }}
          >
            {t.landing.carto}
          </span>
        </div>

        <div
          className="mt-1 pt-2 tracking-[0.06em]"
          style={{
            fontSize: '0.58rem',
            fontFamily: 'var(--font-sans)',
            color: isDark ? 'rgba(180,195,220,0.45)' : 'rgba(80,65,45,0.55)',
            borderTop: isDark ? '1px solid rgba(30,45,80,0.6)' : '1px solid rgba(160,140,110,0.35)',
          }}
        >
          {projects.length} {t.landing.legendSuffix}
        </div>
      </div>

      {/* Drag hint */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none"
        style={{ opacity: 0, animation: 'hintFadeInOut 3.5s ease 1s forwards' }}
      >
        <p
          className="tracking-[0.15em] uppercase"
          style={{
            fontSize: '0.62rem',
            fontFamily: 'var(--font-sans)',
            color: 'rgba(255,255,255,0.40)',
            textAlign: 'center',
          }}
        >
          drag to rotate
        </p>
      </div>

      <style>{`
        @keyframes hintFadeInOut {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          70%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}