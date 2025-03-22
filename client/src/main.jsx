import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import axios from 'axios';

// Configure default axios base URL for API calls
// Automatically use relative URLs in production
axios.defaults.baseURL = import.meta.env.PROD ? '' : 'http://localhost:3000';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
