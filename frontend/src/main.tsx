import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BudgetProvider } from './app/providers/BudgetProvider';
import { ToastProvider } from './shared/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BudgetProvider>
        <App />
      </BudgetProvider>
    </ToastProvider>
  </React.StrictMode>,
);
