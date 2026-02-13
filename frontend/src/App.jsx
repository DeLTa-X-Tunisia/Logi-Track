import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmModal';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import GestionComptes from './pages/GestionComptes';
import Bobines from './pages/Bobines';
import Coulees from './pages/Coulees';
import ChecklistMachine from './pages/ChecklistMachine';
import ChecklistGenerale from './pages/ChecklistGenerale';
import ChecklistPeriodique from './pages/ChecklistPeriodique';
import ParametresProduction from './pages/ParametresProduction';
import HistoriqueChecklist from './pages/HistoriqueChecklist';
import Tubes from './pages/Tubes';
import ParametresProjet from './pages/ParametresProjet';
import ParametresLangue from './pages/ParametresLangue';
import { I18nProvider } from './context/I18nContext';

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <I18nProvider>
        <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Route publique */}
            <Route path="/login" element={<Login />} />
            
            {/* Routes protégées */}
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
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
                    {/* Routes futures pour chaque étape API 5L */}
                    {/* <Route path="/formage/:tubeId" element={<Formage />} /> */}
                    {/* <Route path="/controle-visuel/:tubeId" element={<ControleVisuel />} /> */}
                    {/* <Route path="/soudage/:tubeId" element={<Soudage />} /> */}
                    {/* <Route path="/xray/:tubeId" element={<XRay />} /> */}
                    {/* <Route path="/chanfreinage/:tubeId" element={<Chanfreinage />} /> */}
                    {/* <Route path="/test-hydraulique/:tubeId" element={<TestHydraulique />} /> */}
                  </Routes>
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
