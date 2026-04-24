import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </ThemeProvider>
  );
}
