import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import api from '../services/api';
import { 
  LayoutDashboard, 
  Cylinder, 
  LogOut,
  Menu,
  X,
  Bell,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  UserCog,
  Package,
  Beaker,
  ClipboardCheck,
  Clock,
  CalendarDays,
  CalendarRange,
  Lock,
  Building2,
  Languages,
  Globe,
  Download
} from 'lucide-react';

import ChecklistAlert from './ChecklistAlert';

const API_URL = import.meta.env.VITE_API_URL || '';

const navigationKeys = [
  { key: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { key: 'nav.bobines', href: '/bobines', icon: Package, color: 'text-indigo-500' },
  { key: 'nav.parametres_prod', href: '/parametres-production', icon: Settings, color: 'text-violet-500' },
  { key: 'nav.coulees', href: '/coulees', icon: Beaker, color: 'text-amber-500' },
  { key: 'nav.checklist_machine', href: '/historique-checklist', icon: ClipboardCheck, color: 'text-teal-500' },
  { key: 'nav.tubes', href: '/tubes', icon: Cylinder, color: 'text-blue-500' },
];

const checklistSubMenuKeys = [
  { key: 'nav.debut_quart', href: '/checklists/debut-quart', icon: Clock, code: 'DEBUT_QUART' },
  { key: 'nav.hebdomadaire', href: '/checklists/hebdomadaire', icon: CalendarDays, code: 'HEBDOMADAIRE' },
  { key: 'nav.mensuelle', href: '/checklists/mensuelle', icon: CalendarRange, code: 'MENSUELLE' },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { t, currentLang, langues, changeLanguage, direction } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [projetParams, setProjetParams] = useState(null);
  const userMenuRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  );

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // Detect if app was installed
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
      setIsStandalone(true);
    });
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  // Charger les paramètres du projet
  const fetchProjetParams = () => {
    api.get('/projet-parametres')
      .then(res => setProjetParams(res.data.parametres))
      .catch(() => {});
  };

  useEffect(() => {
    fetchProjetParams();
    // Re-fetch quand les paramètres sont mis à jour depuis la page admin
    const handleUpdate = () => fetchProjetParams();
    window.addEventListener('projet-parametres-updated', handleUpdate);
    return () => window.removeEventListener('projet-parametres-updated', handleUpdate);
  }, []);

  // Fermer le menu utilisateur au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PWA Install Banner */}
      {showInstallBanner && !isStandalone && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:bottom-6 md:w-96 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl shadow-2xl p-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Installer Logi-Track</p>
              <p className="text-xs text-primary-100">Accès rapide en plein écran, comme une app native</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-xs text-primary-200 hover:text-white px-2 py-1"
              >
                Plus tard
              </button>
              <button
                onClick={handleInstall}
                className="bg-white text-primary-700 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-primary-50 transition-colors"
              >
                Installer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/50" onClick={() => setSidebarOpen(false)} />
        <div className={`fixed inset-y-0 w-72 bg-white shadow-xl ${direction === 'rtl' ? 'right-0' : 'left-0'}`}>
          <Sidebar navigationKeys={navigationKeys} checklistSubMenuKeys={checklistSubMenuKeys} location={location} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} t={t} projetParams={projetParams} />
        </div>
      </div>

      {/* Sidebar desktop */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col ${direction === 'rtl' ? 'right-0' : 'left-0'}`}>
        <div className={`flex flex-col flex-grow bg-white ${direction === 'rtl' ? 'border-l' : 'border-r'} border-gray-200`}>
          <Sidebar navigationKeys={navigationKeys} checklistSubMenuKeys={checklistSubMenuKeys} location={location} isAdmin={isAdmin} t={t} projetParams={projetParams} />
        </div>
      </div>

      {/* Contenu principal */}
      <div className={direction === 'rtl' ? 'lg:pr-72' : 'lg:pl-72'}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            {/* Infos Projet dans le header */}
            {projetParams && (projetParams.logo_path || projetParams.client_logo_path || projetParams.client_nom || projetParams.projet_nom) && (
              <div className="hidden md:flex items-center gap-3 ml-4">
                {projetParams.logo_path && (
                  <img
                    src={`${API_URL}/${projetParams.logo_path}`}
                    alt="Logo"
                    className="h-9 w-auto object-contain"
                  />
                )}
                {projetParams.client_logo_path && (
                  <>
                    {projetParams.logo_path && <div className="w-px h-7 bg-gray-200" />}
                    <img
                      src={`${API_URL}/${projetParams.client_logo_path}`}
                      alt="Logo client"
                      className="h-9 w-auto object-contain"
                    />
                  </>
                )}
                {(projetParams.client_nom || projetParams.projet_nom) && (
                  <>
                    {(projetParams.logo_path || projetParams.client_logo_path) && <div className="w-px h-7 bg-gray-200" />}
                    <div className="flex flex-col">
                      {projetParams.client_nom && (
                        <span className="text-sm font-semibold text-gray-700 leading-tight">{projetParams.client_nom}</span>
                      )}
                      {projetParams.projet_nom && (
                        <span className="text-xs text-gray-500 leading-tight">
                          {projetParams.projet_nom}
                          {projetParams.projet_code && (
                            <span className="ml-1.5 px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded text-sm font-bold">
                              {projetParams.projet_code}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 ml-auto">
              {/* Notifications */}
              <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
              </button>

              {/* User menu */}
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="hidden sm:block font-medium text-gray-700">
                    {user?.prenom} {user?.nom}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <div className={`absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-2 animate-fadeIn`}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user?.prenom} {user?.nom}</p>
                      <p className="text-xs text-gray-500">{user?.role}</p>
                    </div>
                    <button className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50">
                      <Settings className="w-4 h-4" />
                      {t('header.parametres', 'Paramètres')}
                    </button>
                    {/* Language selector */}
                    <div className="relative">
                      <button
                        onClick={() => setLangMenuOpen(!langMenuOpen)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                      >
                        <Globe className="w-4 h-4" />
                        <span className="flex-1">{t('header.langue', 'Langue')}</span>
                        <span className="text-xs text-gray-400 uppercase">{currentLang}</span>
                      </button>
                      {langMenuOpen && (
                        <div className="mx-2 mb-1 bg-gray-50 rounded-lg border border-gray-100">
                          {langues.map(l => (
                            <button
                              key={l.code}
                              onClick={() => { changeLanguage(l.code); setLangMenuOpen(false); setUserMenuOpen(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                                currentLang === l.code ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              <img src={`https://flagcdn.com/w40/${l.drapeau}.png`} width={20} alt={l.code} className="inline-block rounded-sm shadow-sm" style={{ aspectRatio: '4/3', objectFit: 'cover' }} />
                              <span>{l.nom_natif}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-left text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('header.deconnexion', 'Déconnexion')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>

        {/* Alerte expiration checklists */}
        <ChecklistAlert />

        {/* Footer */}
        <footer className="border-t border-gray-200 py-4 px-6 text-center">
          <p className="text-sm text-gray-500">
            {t('footer.credit', 'Coded with ❤️ by')} <span className="font-medium text-primary-600">Azizi Mounir</span> – Février 2026
          </p>
        </footer>
      </div>
    </div>
  );
}

function Sidebar({ navigationKeys, checklistSubMenuKeys, location, onClose, isAdmin, t, projetParams }) {
  const [checklistOpen, setChecklistOpen] = useState(
    location.pathname.startsWith('/checklists') || location.pathname.startsWith('/checklist-periodique')
  );

  const isChecklistActive = location.pathname.startsWith('/checklists') || location.pathname.startsWith('/checklist-periodique');

  // Dashboard seul en haut, puis le reste = production
  const dashboardItem = navigationKeys.find(n => n.key === 'nav.dashboard');
  const productionItems = navigationKeys.filter(n => n.key !== 'nav.dashboard');

  // Titre de section projet
  const projetTitle = projetParams?.client_nom
    ? `Projet – ${projetParams.client_nom}`
    : 'Projet';

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
        <Link to="/" className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="Logi-Track" 
            className="h-10 w-auto"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div className="hidden items-center justify-center w-10 h-10 rounded-xl bg-gradient-logitrack">
            <Cylinder className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Logi-Track</h1>
            <p className="text-xs text-gray-500">{t('header.certification', 'Certification API 5L')}</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {/* Section Projet */}
        <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider truncate" title={projetTitle}>
          {projetTitle}
        </p>

        {/* Dashboard */}
        {dashboardItem && (() => {
          const isActive = location.pathname === dashboardItem.href;
          return (
            <Link
              to={dashboardItem.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <dashboardItem.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : dashboardItem.color || 'text-gray-400'}`} />
              {t(dashboardItem.key)}
            </Link>
          );
        })()}

        {/* Sub-menu Checklists Générales (juste après Dashboard) */}
        <div>
          <button
            onClick={() => setChecklistOpen(!checklistOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              isChecklistActive
                ? 'bg-teal-50 text-teal-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardCheck className={`w-5 h-5 ${isChecklistActive ? 'text-teal-600' : 'text-teal-500'}`} />
            <span className="flex-1 text-left">{t('nav.checklists_generales', 'Checklists Générales')}</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${checklistOpen ? 'rotate-0' : '-rotate-90'} ${isChecklistActive ? 'text-teal-500' : 'text-gray-400'}`} />
          </button>
          
          <div className={`overflow-hidden transition-all duration-200 ${checklistOpen ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
            <div className="ml-4 pl-3 border-l-2 border-gray-200 space-y-0.5">
              {checklistSubMenuKeys.map((sub) => {
                const isSubActive = location.pathname === sub.href;
                return (
                  <Link
                    key={sub.code}
                    to={sub.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      isSubActive
                        ? 'bg-teal-50 text-teal-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                    }`}
                  >
                    <sub.icon className={`w-4 h-4 ${isSubActive ? 'text-teal-600' : 'text-gray-400'}`} />
                    {t(sub.key)}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section Étapes de Production */}
        <p className="px-3 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t('nav.etapes_production', 'Étapes de Production')}
        </p>

        {/* Items de production */}
        {productionItems.map((item) => {
          const isActive = location.pathname === item.href;
          
          if (item.disabled) {
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 cursor-not-allowed opacity-60"
                title="Bientôt disponible — Phase 2"
              >
                <item.icon className="w-5 h-5 text-gray-300" />
                <span className="flex-1">{t(item.key)}</span>
                <Lock className="w-3.5 h-3.5 text-gray-300" />
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              to={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : item.color || 'text-gray-400'}`} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      {/* Lien Admin - LogiTracker + Paramètres du Projet */}
      {isAdmin && (
        <div className="px-4 pb-2">
          <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {t('nav.administration', 'Administration')}
          </p>
          <Link
            to="/gestion-comptes"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              location.pathname === '/gestion-comptes'
                ? 'bg-accent-50 text-accent-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <UserCog className={`w-5 h-5 ${location.pathname === '/gestion-comptes' ? 'text-accent-600' : 'text-accent-500'}`} />
            {t('nav.logitracker', 'LogiTracker')}
          </Link>
          <Link
            to="/parametres-projet"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              location.pathname === '/parametres-projet'
                ? 'bg-violet-50 text-violet-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Building2 className={`w-5 h-5 ${location.pathname === '/parametres-projet' ? 'text-violet-600' : 'text-violet-500'}`} />
            {t('nav.parametres_projet', 'Paramètres du Projet')}
          </Link>
          <Link
            to="/parametres-langue"
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
              location.pathname === '/parametres-langue'
                ? 'bg-teal-50 text-teal-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Languages className={`w-5 h-5 ${location.pathname === '/parametres-langue' ? 'text-teal-600' : 'text-teal-500'}`} />
            {t('nav.parametres_langue', 'Paramètres de Langue')}
          </Link>
        </div>
      )}

      {/* Version */}
      <div className="px-6 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">{t('header.version', 'Version 1.0.0')}</p>
      </div>
    </div>
  );
}
