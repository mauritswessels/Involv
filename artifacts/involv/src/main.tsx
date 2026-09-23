import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/errors/AppErrorBoundary';
// Exposes window.seedOpportunities() in dev mode for one-time data seeding
import './utils/seedOpportunities';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
