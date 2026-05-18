import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

export function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { isDark, toggleTheme } = useTheme();
  const { language, t, toggleLanguage } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Shared hover colours for the two small icon/text buttons in the nav.
  // On the landing page the nav sits over a dark globe; elsewhere it sits on
  // the themed background, so hover targets differ.
  const navBtnHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = isLanding ? 'white' : 'var(--site-text)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = isLanding
        ? 'rgba(255,255,255,0.75)'
        : 'var(--site-muted)';
    },
  };

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
                borderBottom: '1px solid var(--site-border)',
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

          {/* Mobile hamburger (visible < md) */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="md:hidden"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isLanding ? 'rgba(255,255,255,0.92)' : 'var(--site-text)',
              padding: 4,
            }}
          >
            <Menu size={22} strokeWidth={1.5} />
          </button>

          {/* Desktop nav links + Controls (hidden < md) */}
          <div className="hidden md:flex items-center gap-6">
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
              {...navBtnHover}
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
              {...navBtnHover}
            >
              {isDark ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu overlay */}
        {menuOpen && (
          <div
            className="md:hidden fixed inset-0 z-[10000] flex flex-col"
            style={{
              background: isDark ? 'rgba(8,10,18,0.98)' : 'rgba(250,250,248,0.98)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between px-8 py-5">
              <span
                className="tracking-[0.15em] uppercase"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '0.82rem',
                  color: 'var(--site-text)',
                }}
              >
                {t.nav.name}
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--site-text)',
                  padding: 4,
                }}
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
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
                    `tracking-[0.15em] uppercase transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-55 hover:opacity-90'
                    }`
                  }
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '1.05rem',
                    color: 'var(--site-text)',
                  }}
                >
                  {label}
                </NavLink>
              ))}

              <div
                style={{
                  width: 40,
                  height: 1,
                  background: 'var(--site-border)',
                  marginTop: 8,
                }}
              />

              <div className="flex items-center gap-8">
                <button
                  onClick={toggleLanguage}
                  title={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.75rem',
                    letterSpacing: '0.15em',
                    color: 'var(--site-muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                  }}
                >
                  {language === 'en' ? 'ES' : 'EN'}
                </button>
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
                    color: 'var(--site-muted)',
                    padding: 4,
                  }}
                >
                  {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Page content — pageFadeIn keyframe is defined in index.css */}
      <main key={location.pathname} className="page-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
