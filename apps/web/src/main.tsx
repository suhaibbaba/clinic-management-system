import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@web/App';
import '@web/i18n';
import { initLanguage } from '@web/i18n/language';
import '@web/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

// Before the first render, so the app never paints Arabic-RTL for a frame and
// then snaps to English-LTR.
initLanguage();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
