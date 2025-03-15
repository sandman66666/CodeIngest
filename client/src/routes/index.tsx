import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { RepositoriesPage } from '@/pages/RepositoriesPage';
import { RepositoryDetailsPage } from '@/pages/RepositoryDetailsPage';
import { AnalysesPage } from '@/pages/AnalysesPage';
import { AnalysisDetailsPage } from '@/pages/AnalysisDetailsPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        
        <Route path="/repositories">
          <Route index element={<RepositoriesPage />} />
          <Route path=":id" element={<RepositoryDetailsPage />} />
        </Route>
        
        <Route path="/analyses">
          <Route index element={<AnalysesPage />} />
          <Route path=":id" element={<AnalysisDetailsPage />} />
        </Route>
        
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
