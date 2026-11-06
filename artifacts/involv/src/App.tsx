import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
import BrowsePage from './pages/BrowsePage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
const CreateOpportunityPage = lazy(() => import('./pages/CreateOpportunityPage'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage'));
const OrganizerDashboardPage = lazy(() => import('./pages/OrganizerDashboardPage'));
const ApplicationsManagementPage = lazy(() => import('./pages/ApplicationsManagementPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SavedOpportunitiesPage = lazy(() => import('./pages/SavedOpportunitiesPage'));
const EditOpportunityPage = lazy(() => import('./pages/EditOpportunityPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ActivityHubPage = lazy(() => import('./pages/ActivityHubPage'));
const ServicePortfolioPage = lazy(() => import('./pages/ServicePortfolioPage'));
const PrivateReflectionsPage = lazy(() => import('./pages/PrivateReflectionsPage'));
import NotFoundPage from './pages/NotFoundPage';
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublisherRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const approved = user && ['teacher', 'organizer', 'admin'].includes(user.role);
  return <PrivateRoute>{approved ? children : <Navigate to="/dashboard" replace />}</PrivateRoute>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PageLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" role="status" aria-label="Loading">
      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <PrivateRoute>
            <OnboardingPage />
          </PrivateRoute>
        }
      />

      <Route path="/browse" element={<Layout><BrowsePage /></Layout>} />
      <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
      <Route path="/opportunities/:id" element={<Layout><OpportunityDetailPage /></Layout>} />

      <Route
        path="/create"
        element={
          <PublisherRoute>
            <Layout><CreateOpportunityPage /></Layout>
          </PublisherRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Layout><StudentDashboardPage /></Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/organizer"
        element={
          <PublisherRoute>
            <Layout><OrganizerDashboardPage /></Layout>
          </PublisherRoute>
        }
      />
      <Route
        path="/applications/:opportunityId"
        element={
          <PublisherRoute>
            <Layout><ApplicationsManagementPage /></Layout>
          </PublisherRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Layout><ProfilePage /></Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/saved"
        element={
          <PrivateRoute>
            <Layout><SavedOpportunitiesPage /></Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/edit/:id"
        element={
          <PublisherRoute>
            <Layout><EditOpportunityPage /></Layout>
          </PublisherRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout><AdminPage /></Layout>
          </AdminRoute>
        }
      />

      <Route
        path="/chat/:opportunityId"
        element={
          <PrivateRoute>
            <Layout><ChatPage /></Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/activity/:opportunityId"
        element={
          <PrivateRoute>
            <Layout><ActivityHubPage /></Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/portfolio"
        element={
          <PrivateRoute>
            <Layout><ServicePortfolioPage /></Layout>
          </PrivateRoute>
        }
      />

      <Route path="/reflections" element={<PrivateRoute><Layout><PrivateReflectionsPage /></Layout></PrivateRoute>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AppProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
