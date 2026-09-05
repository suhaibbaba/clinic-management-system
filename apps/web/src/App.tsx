import type { JSX } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AppProviders } from '@web/app/providers';
import { AppRoutes } from '@web/app/router';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
