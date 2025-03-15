import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RepositoryPage } from './pages/RepositoryPage';
import { useAuth } from './contexts/AuthContext';

export function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/repository/:owner/:name"
        element={
          isAuthenticated ? <RepositoryPage /> : <Navigate to="/login" replace />
        }
      />
    </Routes>
  );
}
