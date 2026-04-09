import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Note: './index.css' has been removed because global styles 
// are now imported directly within the App.jsx controller.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);