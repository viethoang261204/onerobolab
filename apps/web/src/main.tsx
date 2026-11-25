import { setBlockIdSalt } from '@robolab/blocks';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// New block ids must not collide with ids saved in earlier sessions.
setBlockIdSalt(Math.random().toString(36).slice(2, 6));

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
