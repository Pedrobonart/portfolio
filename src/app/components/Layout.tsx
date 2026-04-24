import { NavLink, Outlet, useLocation } from 'react-router';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { isDark, toggleTheme } = useTheme();
  const { language, t, toggleLanguage } = useLanguage();

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--site-bg)', transition: 'background 0.3s' }}
    >
      {/* Navigation */}
      <header
        className={`${isLanding ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-[9999]`}
        style={
          isLanding
            ? { background: 'transparent' }
            : {
                background: isDark
                  ? 'rgba(12,12,10,0.95)'
                  : 'rgba(250,250,248,0.95)',
                backdropFilter: 'blur(8px)',
                borderBottom: `1px solid var(--site-border)`,
              }
        }
      >
        <nav className="flex items-center justify-between px-8 py-5">
          {/* Logo / Name */}
          <NavLink
            to="/"
            className="tracking-[0.15em] uppercase"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '0.82rem',
              color: isLanding ? 'rgba(255,255,255,0.92)' : 'var(--site-text)',
            }}
          >
            {t.nav.name}
          </NavLink>

          {/* Nav links + Controls */}
          <div className="flex items-center gap-6">
            {/* Nav links */}
            {[
              { to: '/', label: t.nav.globe },
              { to: '/projects', label: t.nav.projects },
              { to: '/about', label: t.nav.about },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  `tracking-[0.1em] uppercase transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-45 hover:opacity-80'
                  }`
                }
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.72rem',
                  color: isLanding ? 'rgba(255,255,255,0.92)' : 'var(--site-text)',
                }}
              >
                {label}
              </NavLink>
            ))}

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 16,
                background: isLanding ? 'rgba(255,255,255,0.25)' : 'var(--site-border)',
              }}
            />

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                color: isLanding ? 'rgba(255,255,255,0.75)' : 'var(--site-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.color = isLanding
                  ? 'white'
                  : 'var(--site-text)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = isLanding
                  ? 'rgba(255,255,255,0.75)'
                  : 'var(--site-muted)';
              }}
            >
              {language === 'en' ? 'ES' : 'EN'}
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isLanding ? 'rgba(255,255,255,0.75)' : 'var(--site-muted)',
                padding: 2,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = isLanding
                  ? 'white'
                  : 'var(--site-text)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = isLanding
                  ? 'rgba(255,255,255,0.75)'
                  : 'var(--site-muted)';
              }}
            >
              {isDark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Page content */}
      <main key={location.pathname} className="page-fade-in">
        <Outlet />
      </main>

      <style>{`
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-fade-in {
          animation: pageFadeIn 0.3s ease forwards;
        }
      `}</style>
    </div>
  );
}
