import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import '@beacon/ui/styles.css';
import './app/app.css';
import { routes } from './app/routes';
import { registerServiceWorker } from './pwa';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

registerServiceWorker();
