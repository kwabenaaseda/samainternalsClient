import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider, ToastProvider } from './contexts';
import { App } from './App';
import './index.css';

/**
 * Note: the Layout is deliberately NOT applied here.
 *
 * `App` gates every route behind the resolved authentication state, and it is
 * `App` that wraps the authenticated shell in <Layout>. Mounting the sidebar and
 * header at the root would show application chrome to signed-out or unauthorized
 * users.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
