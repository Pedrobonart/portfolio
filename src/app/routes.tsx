import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { About } from './pages/About';
import { useLanguage } from './context/LanguageContext';

function NotFound() {
  const { t } = useLanguage();

  return (
    <div
      className="min-h-screen flex items-center justify-center pt-16"
      style={{ background: 'var(--site-bg)' }}
    >
      <div className="text-center">
        <p
          className="mb-6"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.85rem',
            color: 'var(--site-muted)',
          }}
        >
          {t.notFound.message}
        </p>
        <a
          href="/"
          className="underline underline-offset-4"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.85rem',
            color: 'var(--site-text)',
          }}
        >
          {t.notFound.returnHome}
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: Landing },
      { path: 'projects', Component: Projects },
      { path: 'projects/:id', Component: ProjectDetail },
      { path: 'about', Component: About },
      { path: '*', Component: NotFound },
    ],
  },
]);
