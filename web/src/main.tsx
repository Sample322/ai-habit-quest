import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installErrorHandlers } from './lib/errors';
import { initSentry } from './lib/sentry';
import './index.css';

// KK: Sentry first so subsequent errors get captured. No-op without DSN.
initSentry();
installErrorHandlers();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
