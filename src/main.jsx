import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';

createRoot(document.getElementById('root')).render(<App />);

// Lets the browser offer "Install app". The worker does no caching (see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/turkey-day-planner/sw.js').catch(() => {
      /* installing is optional; the app works without it */
    });
  });
}
