import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import { setupApiFetch } from './utils/api.js';
import App from './App.jsx';

setupApiFetch();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
