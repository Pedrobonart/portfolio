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
          opacity: 0.5,
        }}
      />

      {/* Hero text (bottom-left) */}
      <div className="absolute top-[64px] md:top-11 left-8 z-[1000] pointer-events-none">
        <p
          className="tracking-[0.2em] leading-tight"
          style={{
            fontSize: '0.62rem',
            fontFamily: 'var(--font-sans)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {(() => {
            const [first, ...rest] = t.landing.subtitle.split(' & ');
            const second = rest.length ? `& ${rest.join(' & ')}` : '';
            return (
              <>
                <span className="block md:inline">{first}{second ? ' ' : ''}</span>
                {second && <span className="block md:inline">{second}</span>}
              </>
            );
          })()}
        </p>
      </div>

      {/* Legend (bottom-right) — colours follow theme */}
      <div
        className="absolute bottom-10 left-5 right-5 md:left-auto z-[1000] px-0 md:px-5 py-3 md:py-4 flex flex-col gap-2 md:gap-3"
        style={{
          background: 'var(--legend-bg)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--legend-border)',
        }}
      >
        {/* Row 1 — project type indicators (single row on mobile, stacked on desktop) */}
        <div className="flex flex-row md:flex-col items-center md:items-stretch justify-between md:justify-start gap-0 md:gap-3 px-12 md:px-0">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 10,
                height: 10,
                background: 'var(--legend-arch)',
                transform: 'rotate(45deg)',
                flexShrink: 0,
                boxShadow: '0 0 0 1.5px var(--legend-halo), 0 0 0 2.5px var(--legend-arch)',
              }}
            />
            <span
              className="tracking-[0.1em] uppercase leading-tight"
              style={{ fontSize: '0.62rem', fontFamily: 'var(--font-sans)', color: 'var(--legend-label)' }}
            >
              {(() => {
                const [first, ...rest] = t.landing.arch.split(' ');
                const tail = rest.join(' ');
                return (
                  <>
                    <span className="block md:inline">{first}{tail ? ' ' : ''}</span>
                    {tail && <span className="block md:inline">{tail}</span>}
                  </>
                );
              })()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--legend-carto)',
                flexShrink: 0,
                boxShadow: '0 0 0 2px var(--legend-halo), 0 0 0 3.5px var(--legend-carto)',
              }}
            />
            <span
              className="tracking-[0.1em] uppercase leading-tight"
              style={{ fontSize: '0.62rem', fontFamily: 'var(--font-sans)', color: 'var(--legend-label)' }}
            >
              {(() => {
                const [first, ...rest] = t.landing.carto.split(' ');
                const tail = rest.join(' ');
                return (
                  <>
                    <span className="block md:inline">{first}{tail ? ' ' : ''}</span>
                    {tail && <span className="block md:inline">{tail}</span>}
                  </>
                );
              })()}
            </span>
          </div>
        </div>

        {/* Row 2 — instructions */}
        <div
          className="tracking-[0.06em] mx-5 md:mx-0 pt-2 border-t"
          style={{
            fontSize: '0.58rem',
            fontFamily: 'var(--font-sans)',
            color: 'var(--legend-caption)',
            borderTopColor: 'var(--legend-divider)',
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