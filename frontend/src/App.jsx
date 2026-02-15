import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './context/I18nContext';

// Lazy load des pages (code splitting)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const GestionComptes = lazy(() => import('./pages/GestionComptes'));
const Bobines = lazy(() => import('./pages/Bobines'));
const Coulees = lazy(() => import('./pages/Coulees'));
const ChecklistMachine = lazy(() => import('./pages/ChecklistMachine'));
const ChecklistGenerale = lazy(() => import('./pages/ChecklistGenerale'));
const ChecklistPeriodique = lazy(() => import('./pages/ChecklistPeriodique'));
const ParametresProduction = lazy(() => import('./pages/ParametresProduction'));
const HistoriqueChecklist = lazy(() => import('./pages/HistoriqueChecklist'));
const Tubes = lazy(() => import('./pages/Tubes'));
const ParametresProjet = lazy(() => import('./pages/ParametresProjet'));
const ParametresLangue = lazy(() => import('./pages/ParametresLangue'));

// Spinner de chargement pour Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="text-sm text-gray-400">Chargement...</span>
    </div>
  </div>
);

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <I18nProvider>
        <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Route publique */}
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            
            {/* Routes protégées */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/bobines" element={<Bobines />} />
                    <Route path="/parametres-production" element={<ParametresProduction />} />
                    <Route path="/coulees" element={<Coulees />} />
                    <Route path="/tubes" element={<Tubes />} />
                    <Route path="/historique-checklist" element={<HistoriqueChecklist />} />
                    <Route path="/checklists/:typeSlug" element={<ChecklistGenerale />} />
                    <Route path="/checklist-machine/:couleeId" element={<ChecklistMachine />} />
                    <Route path="/checklist-periodique/:sessionId" element={<ChecklistPeriodique />} />
                    <Route path="/gestion-comptes" element={<GestionComptes />} />
                    <Route path="/parametres-projet" element={<ParametresProjet />} />
                    <Route path="/parametres-langue" element={<ParametresLangue />} />
                  </Routes>
                  </Suspense>
                  </ErrorBoundary>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
      </I18nProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
