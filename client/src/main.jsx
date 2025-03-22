import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import axios from 'axios';
import { AuthProvider } from './contexts/AuthContext';

// Configure default axios base URL for API calls
// Automatically use relative URLs in production
axios.defaults.baseURL = import.meta.env.PROD ? '' : 'http://localhost:3000';

// Enable credentials for all requests to support session cookies
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
