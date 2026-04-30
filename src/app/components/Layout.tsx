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
  // Close the mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

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
            className="tracking-[0.15em] uppercase leading-tight"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '0.82rem',
              color: isLanding ? 'rgba(255,255,255,0.92)' : 'var(--site-text)',
            }}
          >
            {(() => {
              const parts = t.nav.name.split(' ');
              const first = parts[0];
              const rest = parts.slice(1).join(' ');
              return (
                <>
                  <span className="block md:inline">{first}{rest ? ' ' : ''}</span>
                  {rest && <span className="block md:inline">{rest}</span>}
                </>
              );
            })()}
          </NavLink>

          {/* Nav links + Controls — desktop only */}
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

          {/* Mobile-only: language toggle + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              style={{
                background: menuOpen
                  ? ('var(--menu-bg-strong)')
                  : 'transparent',
                backdropFilter: menuOpen ? 'blur(8px)' : undefined,
                border: 'none', cursor: 'pointer',
                color: isLanding && !menuOpen ? 'rgba(255,255,255,0.9)' : 'var(--site-text)',
                padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s ease, color 0.2s ease',
              }}
            >
              <span style={{ position: 'relative', width: 20, height: 20, display: 'inline-block' }}>
                <Menu
                  size={20}
                  strokeWidth={1.5}
                  style={{
                    position: 'absolute', inset: 0,
                    opacity: menuOpen ? 0 : 1,
                    transform: menuOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'opacity 0.2s ease, transform 0.25s ease',
                  }}
                />
                <X
                  size={20}
                  strokeWidth={1.5}
                  style={{
                    position: 'absolute', inset: 0,
                    opacity: menuOpen ? 1 : 0,
                    transform: menuOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'opacity 0.2s ease, transform 0.25s ease',
                  }}
                />
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div
            className="md:hidden flex flex-col w-fit ml-auto mr-8 -mt-5 menu-drop"
            style={{
              background: 'var(--menu-bg)',
              backdropFilter: 'blur(8px)',
              borderLeft: '1px solid var(--site-border)',
              borderTop: '1px solid var(--site-border)',
              borderBottom: '1px solid var(--site-border)',
              transformOrigin: 'top right',
            }}
          >
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
                    isActive ? 'opacity-100' : 'opacity-60'
                  }`
                }
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.85rem',
                  color: 'var(--site-text)',
                  padding: '14px 16px 14px 32px',
                  borderBottom: '1px solid var(--site-border)',
                  textAlign: 'right',
                }}
              >
                {label}
              </NavLink>
            ))}
            <div style={{ display: 'flex', alignItems: 'stretch', background: 'var(--menu-bg-strong)' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                <button
                  onClick={toggleLanguage}
                  aria-label={language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.1em',
                    // Letter-spacing adds trailing space after the last glyph,
                    // pushing the text optically to the right. Compensate so
                    // the visual mass sits centered.
                    paddingLeft: '0.1em',
                    color: 'var(--site-text)',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  {language === 'en' ? 'ES' : 'EN'}
                </button>
              </div>
              <div style={{ alignSelf: 'center', width: 1, height: 18, background: 'var(--site-border)' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0' }}>
                <button
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--site-text)',
                    padding: 0,
                  }}
                >
                  {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          </div>
        )}
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
        @keyframes menuDrop {
          from { transform: scaleY(0.05) scaleX(0.85); opacity: 0; }
          to   { transform: scaleY(1) scaleX(1); opacity: 1; }
        }
        .menu-drop {
          animation: menuDrop 0.22s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
