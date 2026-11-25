import { setBlockIdSalt } from '@robolab/blocks';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initLocale } from './features/i18n/i18n';
import './styles.css';

// New block ids must not collide with ids saved in earlier sessions.
setBlockIdSalt(Math.random().toString(36).slice(2, 6));
// Vietnamese by default; the student's choice is remembered.
initLocale();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
