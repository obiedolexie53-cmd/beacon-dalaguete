import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { AuthProvider } from '@beacon/auth';
import '@beacon/ui/styles.css';
import './app/app.css';
import { routes } from './app/routes';
import { api } from './lib/api';
import { registerServiceWorker } from './pwa';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider client={api}>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);

registerServiceWorker();
