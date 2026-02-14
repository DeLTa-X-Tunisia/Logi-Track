/**
 * Page Coulées - Début de poste / Changement de format
 * Workflow simplifié: Sélection bobine → Réception → Installation → Checklist → Production
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Plus, Trash2, Search, Eye, X, Check, Clock, 
  AlertTriangle, Package, Play, Square, ChevronRight,
  RefreshCw, CheckCircle, Circle, Truck, Wrench, ClipboardCheck,
  Settings, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Save, Edit3,
  Cylinder, FileDown
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import api from '../services/api';
import { useTranslation } from '../context/I18nContext';

// Statuts avec couleurs
const STATUTS = {
  en_cours: { labelKey: 'coulees.en_cours', color: 'bg-blue-100 text-blue-700', icon: Clock },
  pret_production: { labelKey: 'coulees.pret_production_label', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  en_production: { labelKey: 'coulees.en_production', color: 'bg-orange-100 text-orange-700', icon: Play },
  termine: { labelKey: 'coulees.termine', color: 'bg-gray-100 text-gray-600', icon: Check },
  annule: { labelKey: 'coulees.annule', color: 'bg-red-100 text-red-700', icon: X }
};

export default function Coulees() {
  const { showToast } = useToast();
  const { confirmDelete } = useConfirm();
  const { t } = useTranslation();
  const [coulees, setCoulees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCoulee, setSelectedCoulee] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [stats, setStats] = useState(null);

  // Data pour nouveau
  const [bobinesDisponibles, setBobinesDisponibles] = useState([]);
  const [prochainNumero, setProchainNumero] = useState('');
  const [motifsRetard, setMotifsRetard] = useState({ reception: [], installation: [] });

  // Suppression coulée avec choix bobine
  const [showDeleteModal, setShowDeleteModal] = useState(null); // coulée à supprimer
  const [preselectedBobineId, setPreselectedBobineId] = useState(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchCoulees();
    fetchStats();
  }, []);

  // Auto-open detail modal if ?open=couleeId in URL
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && coulees.length > 0 && !showDetailModal) {
      const coulee = coulees.find(c => String(c.id) === openId);
      if (coulee) {
        openDetailModal(coulee);
        setSearchParams({}, { replace: true });
      }
    }
  }, [coulees, searchParams]);

  const fetchCoulees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/coulees');
      setCoulees(response.data);
    } catch (error) {
      showToast('Erreur chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/coulees/stats');
      setStats(response.data);
    } catch (e) { console.error(e); }
  };

  const fetchBobinesDisponibles = async () => {
    try {
      const response = await api.get('/coulees/bobines-disponibles');
      setBobinesDisponibles(response.data);
    } catch (e) { console.error(e); }
  };

  const fetchProchainNumero = async () => {
    try {
      const response = await api.get('/coulees/prochain-numero');
      setProchainNumero(response.data.numero);
    } catch (e) { console.error(e); }
  };

  const fetchMotifsRetard = async () => {
    try {
      const response = await api.get('/coulees/motifs-retard');
      setMotifsRetard(response.data.grouped);
    } catch (e) { console.error(e); }
  };

  const [presetsDisponibles, setPresetsDisponibles] = useState([]);

  const fetchPresets = async () => {
    try {
      const response = await api.get('/parametres');
      setPresetsDisponibles(response.data);
    } catch (e) { console.error(e); }
  };

  const openNewModal = async () => {
    await Promise.all([fetchBobinesDisponibles(), fetchProchainNumero(), fetchMotifsRetard(), fetchPresets()]);
    setShowNewModal(true);
  };

  const openDetailModal = async (coulee) => {
    await Promise.all([fetchMotifsRetard(), fetchPresets()]);
    setSelectedCoulee(coulee);
    setShowDetailModal(true);
  };

  const handleCreateCoulee = async (bobineId, numeroCoulee, parametreId) => {
    try {
      // Utiliser le numéro saisi ou le numéro auto
      const numero = numeroCoulee && numeroCoulee.trim() ? numeroCoulee.trim() : prochainNumero;
      const response = await api.post('/coulees', { numero, bobine_id: bobineId || null, parametre_id: parametreId || null });
      showToast(t('coulees.msg_creee'), 'success');
      setShowNewModal(false);
      fetchCoulees();
      fetchStats();

      // Ouvrir directement le modal détail de la coulée créée
      try {
        const newId = response.data.id;
        await fetchMotifsRetard();
        await fetchPresets();
        const detail = await api.get(`/coulees/${newId}`);
        setSelectedCoulee(detail.data);
        setShowDetailModal(true);
      } catch (e) { console.error('Erreur ouverture détail:', e); }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDeleteRequest = (coulee) => {
    setShowDeleteModal(coulee);
  };

  // Télécharger le rapport PDF d'une coulée
  const downloadCouleePdf = async (couleeId, numero) => {
    try {
      const token = localStorage.getItem('logitrack_token');
      const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3002/api`;
      const response = await fetch(`${API_URL}/coulees/${couleeId}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Erreur téléchargement');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coulee_${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Rapport PDF téléchargé', 'success');
    } catch (error) {
      showToast('Erreur lors du téléchargement du PDF', 'error');
    }
  };

  const handleDeleteConfirm = async (action) => {
    // action: 'disponible' ou 'prochaine'
    const coulee = showDeleteModal;
    if (!coulee) return;
    try {
      await api.delete(`/coulees/${coulee.id}`);
      if (action === 'prochaine' && coulee.bobine_id) {
        setPreselectedBobineId(coulee.bobine_id);
        showToast(t('coulees.msg_supprimee'), 'success');
      } else {
        showToast(t('coulees.msg_supprimee'), 'success');
      }
      setShowDeleteModal(null);
      fetchCoulees();
      fetchStats();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const refreshCoulee = async () => {
    if (!selectedCoulee) return;
    try {
      const response = await api.get(`/coulees/${selectedCoulee.id}`);
      setSelectedCoulee(response.data);
      fetchCoulees();
      fetchStats();
    } catch (e) { console.error(e); }
  };

  // Filtrage
  const filteredCoulees = coulees.filter(c => {
    const matchSearch = !searchQuery || 
      c.numero?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.bobine_numero?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatut = !filterStatut || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Play className="w-7 h-7 text-amber-500" />
            {t('coulees.sous_titre')}
          </h1>
          <p className="text-gray-500 mt-1">{t('coulees.description')}</p>
        </div>
        <div className="flex items-center gap-3">
          {preselectedBobineId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Package className="w-4 h-4" />
              <span>{t('coulees.bobine_pre_selectionnee')}</span>
              <button onClick={() => setPreselectedBobineId(null)} className="ml-1 text-blue-400 hover:text-blue-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={openNewModal}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors shadow-sm ${
              preselectedBobineId ? 'bg-blue-500 hover:bg-blue-600 animate-pulse' : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <Plus className="w-5 h-5" />
            {t('coulees.nouvelle')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t('coulees.en_cours')} value={stats.en_cours || 0} color="bg-blue-500" icon={Clock} />
          <StatCard label={t('coulees.pret_production_label')} value={stats.pret_production || 0} color="bg-green-500" icon={CheckCircle} />
          <StatCard label={t('coulees.en_production')} value={stats.en_production || 0} color="bg-orange-500" icon={Play} />
          <StatCard label={t('coulees.termine')} value={stats.termine || 0} color="bg-gray-500" icon={Check} />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('coulees.rechercher')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <select
          value={filterStatut}
          onChange={(e) => setFilterStatut(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
        >
          <option value="">{t('coulees.tous_statuts')}</option>
          {Object.entries(STATUTS).map(([k, v]) => (
            <option key={k} value={k}>{t(v.labelKey)}</option>
          ))}
        </select>
        <button onClick={fetchCoulees} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Liste des coulées */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredCoulees.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>{t('coulees.aucune_trouvee')}</p>
            <button onClick={openNewModal} className="mt-4 text-amber-600 hover:underline">
              {t('coulees.creer_nouvelle')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCoulees.map((coulee) => (
              <CouleeRow 
                key={coulee.id} 
                coulee={coulee} 
                onView={() => openDetailModal(coulee)}
                onDelete={() => handleDeleteRequest(coulee)}
                onDownloadPdf={() => downloadCouleePdf(coulee.id, coulee.numero)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Suppression Coulée */}
      {showDeleteModal && (
        <DeleteCouleeModal
          coulee={showDeleteModal}
          onClose={() => setShowDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Modal Nouvelle Coulée */}
      {showNewModal && (
        <NewCouleeModal
          numero={prochainNumero}
          bobines={bobinesDisponibles}
          presets={presetsDisponibles}
          preselectedBobineId={preselectedBobineId}
          onClose={() => setShowNewModal(false)}
          onCreate={(bobineId, numeroCoulee, parametreId) => {
            handleCreateCoulee(bobineId, numeroCoulee, parametreId);
            setPreselectedBobineId(null);
          }}
        />
      )}

      {/* Modal Détail Coulée */}
      {showDetailModal && selectedCoulee && (
        <CouleeDetailModal
          coulee={selectedCoulee}
          motifsRetard={motifsRetard}
          presets={presetsDisponibles}
          onClose={() => { setShowDetailModal(false); setSelectedCoulee(null); }}
          onRefresh={refreshCoulee}
          onPresetsChange={fetchPresets}
        />
      )}
    </div>
  );
}

// ============================================
// Composants
// ============================================

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`${color} p-2 rounded-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function CouleeRow({ coulee, onView, onDelete, onDownloadPdf }) {
  const { t } = useTranslation();
  const statut = STATUTS[coulee.statut] || STATUTS.en_cours;
  const StatusIcon = statut.icon;
  
  // Calcul progression (5 étapes du workflow)
  const steps = [
    { done: !!coulee.bobine_id, label: t('coulees.bobine') },
    { done: !!coulee.bobine_recue, label: t('coulees.recue') },
    { done: !!coulee.bobine_installee, label: t('coulees.installee') },
    { done: !!coulee.checklist_validee, label: t('coulees.checklist') },
    { done: coulee.statut === 'en_production' || coulee.statut === 'termine', label: t('coulees.production') }
  ];
  const progress = steps.filter(s => s.done).length;

  // Helper pour formater les durées lisibles
  const formatDuree = (mins) => {
    if (!mins || mins <= 0) return null;
    const j = Math.floor(mins / (24 * 60));
    const h = Math.floor((mins % (24 * 60)) / 60);
    const m = mins % 60;
    const parts = [];
    if (j > 0) parts.push(`${j}j`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}mn`);
    return parts.join(' ');
  };

  const retardRec = coulee.retard_reception_minutes || 0;
  const retardInst = coulee.retard_installation_minutes || 0;
  const retardTotal = retardRec + retardInst;
  const hasRetard = retardTotal > 0;

  const getRetardColor = (mins) => {
    if (mins < 5) return 'text-blue-600';
    if (mins < 10) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      {/* ====== DESKTOP LAYOUT (md+) ====== */}
      <div className="hidden md:block space-y-1.5">
        {/* Ligne 1 : Numéro de coulée | Bobine | Preset | Progression | Actions */}
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0 min-w-[160px]">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('coulees.numero')}</span>
            <div className="font-mono font-bold text-lg text-amber-600">{coulee.numero}</div>
          </div>

          <div className="flex-1 min-w-0">
            {coulee.bobine_numero ? (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-gray-500">{t('bobines.numero')} :</span>
                <span className="font-semibold text-gray-900">{coulee.bobine_numero}</span>
                <span className="text-sm text-gray-500">
                  ({coulee.bobine_epaisseur}mm × {coulee.bobine_largeur}mm)
                </span>
              </div>
            ) : (
              <span className="text-gray-400 italic text-sm">Aucune bobine sélectionnée</span>
            )}
          </div>

          {coulee.parametre_numero && (
            <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
              <Settings className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                {coulee.parametre_numero}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {step.done ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-4 h-0.5 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs font-medium text-gray-600">{progress}/{steps.length}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onDownloadPdf} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg" title="Télécharger PDF">
              <FileDown className="w-5 h-5" />
            </button>
            <button onClick={onView} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
              <Eye className="w-5 h-5" />
            </button>
            <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Ligne 2 : Statut | Temps + Retards */}
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0 min-w-[160px]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{t('common.statut')} :</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statut.color}`}>
                <StatusIcon className="w-3 h-3" />
                {t(statut.labelKey)}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {coulee.created_at && (
              <>
                <span className="text-gray-500 font-medium">Temps :</span>
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Démarrée le {new Date(coulee.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                {retardRec > 0 && (
                  <span className={`flex items-center gap-1 font-medium ${getRetardColor(retardRec)}`}>
                    <Truck className="w-3.5 h-3.5" />
                    Réception : {formatDuree(retardRec)}
                  </span>
                )}
                {retardInst > 0 && (
                  <span className={`flex items-center gap-1 font-medium ${getRetardColor(retardInst)}`}>
                    <Wrench className="w-3.5 h-3.5" />
                    Installation : {formatDuree(retardInst)}
                  </span>
                )}
                {hasRetard && (retardRec > 0 && retardInst > 0) && (
                  <span className={`flex items-center gap-1 font-bold text-sm ${getRetardColor(retardTotal)}`}>
                    <AlertTriangle className="w-4 h-4" />
                    Total : {formatDuree(retardTotal)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ====== MOBILE LAYOUT (<md) ====== */}
      <div className="md:hidden space-y-3">
        {/* Header : Numéro + Statut + Actions */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{t('coulees.numero')}</span>
            <div className="font-mono font-bold text-xl text-amber-600">{coulee.numero}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statut.color}`}>
              <StatusIcon className="w-3 h-3" />
              {t(statut.labelKey)}
            </span>
            <button onClick={onDownloadPdf} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg">
              <FileDown className="w-4 h-4" />
            </button>
            <button onClick={onView} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
              <Eye className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Infos : Bobine + Preset */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {coulee.bobine_numero ? (
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs text-gray-500">Bobine :</span>
              <span className="text-sm font-semibold text-gray-900">{coulee.bobine_numero}</span>
              <span className="text-xs text-gray-400">
                ({coulee.bobine_epaisseur}×{coulee.bobine_largeur}mm)
              </span>
            </div>
          ) : (
            <span className="text-gray-400 italic text-xs">Aucune bobine</span>
          )}
          {coulee.parametre_numero && (
            <span className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-full border border-violet-200 flex items-center gap-1">
              <Settings className="w-3 h-3 text-violet-500" />
              {coulee.parametre_numero}
            </span>
          )}
        </div>

        {/* Progression mini */}
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {step.done ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-3 h-0.5 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
          <span className="text-xs font-medium text-gray-500 ml-1">{progress}/{steps.length}</span>
        </div>

        {/* Temps & Retards */}
        {coulee.created_at && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Démarrée le {new Date(coulee.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {retardRec > 0 && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${getRetardColor(retardRec)}`}>
                <Truck className="w-3.5 h-3.5" />
                <span>Réception : {formatDuree(retardRec)}</span>
              </div>
            )}
            {retardInst > 0 && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${getRetardColor(retardInst)}`}>
                <Wrench className="w-3.5 h-3.5" />
                <span>Installation : {formatDuree(retardInst)}</span>
              </div>
            )}
            {hasRetard && (retardRec > 0 && retardInst > 0) && (
              <div className={`flex items-center gap-1.5 text-xs font-bold ${getRetardColor(retardTotal)}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Total : {formatDuree(retardTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Modal Suppression Coulée (choix bobine)
function DeleteCouleeModal({ coulee, onClose, onConfirm }) {
  const { t } = useTranslation();
  const hasBobine = !!coulee.bobine_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            {t('coulees.supprimer_coulee')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Vous allez supprimer la coulée <strong className="font-mono text-amber-600">{coulee.numero}</strong>.
          </p>

          {hasBobine ? (
            <>
              <p className="text-sm text-gray-600">
                La bobine <strong>{coulee.bobine_numero}</strong> ({coulee.bobine_epaisseur}mm × {coulee.bobine_largeur}mm) est associée à cette coulée.
                Que souhaitez-vous faire ?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => onConfirm('disponible')}
                  className="w-full flex items-center gap-3 p-4 border-2 border-green-200 rounded-xl hover:bg-green-50 hover:border-green-400 transition-all group text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{t('coulees.rendre_bobine')}</div>
                    <div className="text-sm text-gray-500">La bobine retourne dans le stock et pourra être sélectionnée librement</div>
                  </div>
                </button>

                <button
                  onClick={() => onConfirm('prochaine')}
                  className="w-full flex items-center gap-3 p-4 border-2 border-amber-200 rounded-xl hover:bg-amber-50 hover:border-amber-400 transition-all group text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200">
                    <Play className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{t('coulees.ajouter_prochaine')}</div>
                    <div className="text-sm text-gray-500">La bobine sera pré-sélectionnée automatiquement lors de la création</div>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 italic">Aucune bobine n'est associée à cette coulée.</p>
              <button
                onClick={() => onConfirm('disponible')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
              >
                <Trash2 className="w-4 h-4" /> {t('coulees.confirmer_suppression')}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-3 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
            {t('common.annuler')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Nouvelle Coulée
function NewCouleeModal({ numero, bobines, presets, preselectedBobineId, onClose, onCreate }) {
  const { t } = useTranslation();
  const [selectedBobine, setSelectedBobine] = useState(preselectedBobineId ? String(preselectedBobineId) : '');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [numeroCoulee, setNumeroCoulee] = useState(numero);

  // Notification de pré-sélection
  const isPreselected = preselectedBobineId && String(preselectedBobineId) === selectedBobine;

  const selectedBobineData = bobines.find(b => b.id === Number(selectedBobine));
  const selectedPresetData = presets?.find(p => p.id === Number(selectedPreset));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
          <h2 className="text-xl font-bold text-gray-900">
            {t('coulees.nouvelle_titre')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Numéro de coulée - saisie manuelle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('coulees.numero')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={numeroCoulee}
                onChange={(e) => setNumeroCoulee(e.target.value)}
                placeholder="Saisir le numéro ou laisser vide pour auto"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono text-lg"
              />
              <button
                type="button"
                onClick={() => setNumeroCoulee(numero)}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                title="Réinitialiser au numéro suggéré"
              >
                Auto
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Suggestion: <span className="font-mono font-medium">{numero}</span>
            </p>
          </div>

          {/* Sélection bobine - liste déroulante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('coulees.selectionner_bobine')} <span className="text-red-500">*</span>
            </label>
            {bobines.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">{t('coulees.aucune_bobine')}</p>
                  <p className="text-xs text-red-600 mt-0.5">Ajoutez une bobine en stock depuis la page Bobines pour pouvoir créer une coulée.</p>
                </div>
              </div>
            ) : (
              <>
                <select
                  value={selectedBobine}
                  onChange={(e) => setSelectedBobine(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900"
                >
                  <option value="">-- {t('coulees.choisir_bobine')} --</option>
                  {bobines.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.numero} - {b.epaisseur}mm × {b.largeur}mm - {b.poids}kg {b.fournisseur ? `(${b.fournisseur})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {bobines.length} bobine{bobines.length > 1 ? 's' : ''} disponible{bobines.length > 1 ? 's' : ''}
                </p>
              </>
            )}
          </div>

          {/* Notification pré-sélection */}
          {isPreselected && selectedBobineData && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              <span>Bobine <strong>{selectedBobineData.numero}</strong> {t('coulees.bobine_pre_selectionnee')}</span>
            </div>
          )}

          {/* Aperçu bobine sélectionnée */}
          {selectedBobineData && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-amber-600" />
                <div>
                  <div className="font-bold text-amber-800 text-lg">{selectedBobineData.numero}</div>
                  <div className="text-sm text-amber-600">
                    {selectedBobineData.epaisseur}mm × {selectedBobineData.largeur}mm - {selectedBobineData.poids}kg
                  </div>
                  {selectedBobineData.fournisseur && (
                    <div className="text-xs text-gray-500">{t('bobines.fournisseur')}: {selectedBobineData.fournisseur}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sélection preset paramètres */}
          {presets && presets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('coulees.parametres_production')} <span className="text-gray-400">(optionnel)</span>
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white text-gray-900"
              >
                <option value="">{t('coulees.aucun_preset_label')}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.numero} — Strip {p.strip_vitesse_m}m{String(p.strip_vitesse_cm).padStart(2,'0')} | Tack {p.tack_amperage}A/{p.tack_voltage}V
                  </option>
                ))}
              </select>
              {selectedPresetData && (
                <div className="mt-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm space-y-1">
                  <div className="font-medium text-violet-800">{selectedPresetData.numero}</div>
                  <div className="text-violet-600">
                    Milling: {selectedPresetData.milling_edge_gauche}°/{selectedPresetData.milling_edge_droit}° •
                    Têtes: {(selectedPresetData.heads || []).filter(h => h.actif).length}/{(selectedPresetData.heads || []).length} actives
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            {t('common.annuler')}
          </button>
          <button
            onClick={() => onCreate(selectedBobine ? Number(selectedBobine) : null, numeroCoulee, selectedPreset ? Number(selectedPreset) : null)}
            disabled={!selectedBobine}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
              selectedBobine ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4" />
            {t('coulees.demarrer_coulee')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Options pour paramètres
const GAZ_OPTIONS = [
  { value: 'CO2', label: 'CO₂' },
  { value: 'Argon_CO2', label: 'Argon / CO₂ Mix' },
  { value: 'Argon_O2', label: 'Argon / O₂ Mix' },
  { value: 'Argon_pur', label: 'Argon pur' },
  { value: 'Autre', label: 'Autre' }
];
const FIL_OPTIONS = ['1.0mm', '1.2mm', '1.6mm', '2.0mm', '2.4mm', '3.2mm', '4.0mm'];
const FLUX_OPTIONS = [
  { value: 'SAW', label: 'SAW (Submerged Arc)' },
  { value: 'FCAW', label: 'FCAW (Flux-Cored)' },
  { value: 'GMAW', label: 'GMAW (Gas Metal)' },
  { value: 'Autre', label: 'Autre' }
];
const DEFAULT_HEADS = [
  { type: 'ID', numero: 1, actif: true, amperage: 0, voltage: 0 },
  { type: 'ID', numero: 2, actif: true, amperage: 0, voltage: 0 },
  { type: 'ID', numero: 3, actif: false, amperage: 0, voltage: 0 },
  { type: 'OD', numero: 1, actif: true, amperage: 0, voltage: 0 },
  { type: 'OD', numero: 2, actif: true, amperage: 0, voltage: 0 },
];

// Modal Détail Coulée (Workflow)
function CouleeDetailModal({ coulee, motifsRetard, presets, onClose, onRefresh, onPresetsChange }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirmReset } = useConfirm();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showRetardForm, setShowRetardForm] = useState(null); // 'reception' ou 'installation'
  const [retardData, setRetardData] = useState({ minutes: 0, motif_id: '', commentaire: '' });

  // État pour la section paramètres
  const [parametreMode, setParametreMode] = useState(null); // null, 'select', 'edit'
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [editForm, setEditForm] = useState({});
  const [editHeads, setEditHeads] = useState([]);
  const [openSections, setOpenSections] = useState({ formage: true, tack: false, soudure: false });
  const [savingParam, setSavingParam] = useState(false);

  // État pour la checklist rapide
  const [derniereValidation, setDerniereValidation] = useState(null);
  const [validationRapideLoading, setValidationRapideLoading] = useState(false);

  // Charger la dernière validation au montage
  useEffect(() => {
    const fetchDerniereValidation = async () => {
      try {
        const res = await api.get('/checklist/derniere-validation');
        setDerniereValidation(res.data);
      } catch (e) { console.error(e); }
    };
    fetchDerniereValidation();
  }, [coulee.id]);

  const handleValidationRapide = async () => {
    setValidationRapideLoading(true);
    try {
      const res = await api.post(`/checklist/validation-rapide/${coulee.id}`);
      showToast(res.data.message, 'success');
      onRefresh();
    } catch (error) {
      showToast(error.response?.data?.error || 'Erreur validation rapide', 'error');
    } finally {
      setValidationRapideLoading(false);
    }
  };

  // Charger les détails du preset actuel pour l'édition
  const loadPresetForEdit = async () => {
    if (coulee.parametre_id) {
      try {
        const res = await api.get(`/parametres/${coulee.parametre_id}`);
        const p = res.data;
        setEditForm({
          strip_vitesse_m: p.strip_vitesse_m || 0, strip_vitesse_cm: p.strip_vitesse_cm || 0,
          milling_edge_gauche: p.milling_edge_gauche || 40, milling_edge_droit: p.milling_edge_droit || 40,
          pression_rouleaux: p.pression_rouleaux || '', pression_rouleaux_unite: p.pression_rouleaux_unite || 'tonnes',
          tack_amperage: p.tack_amperage || 0, tack_voltage: p.tack_voltage || 0,
          tack_vitesse_m: p.tack_vitesse_m || 0, tack_vitesse_cm: p.tack_vitesse_cm || 0,
          tack_frequence: p.tack_frequence || '', tack_type_gaz: p.tack_type_gaz || 'CO2', tack_debit_gaz: p.tack_debit_gaz || '',
          soudure_vitesse_m: p.soudure_vitesse_m || 0, soudure_vitesse_cm: p.soudure_vitesse_cm || 0,
          soudure_type_fil: p.soudure_type_fil || '1.6mm', soudure_type_flux: p.soudure_type_flux || 'SAW',
          notes: p.notes || ''
        });
        setEditHeads(p.heads && p.heads.length > 0 ? p.heads : JSON.parse(JSON.stringify(DEFAULT_HEADS)));
      } catch (e) { console.error(e); }
    } else {
      setEditForm({
        strip_vitesse_m: 0, strip_vitesse_cm: 0,
        milling_edge_gauche: 40, milling_edge_droit: 40,
        pression_rouleaux: '', pression_rouleaux_unite: 'tonnes',
        tack_amperage: 0, tack_voltage: 0,
        tack_vitesse_m: 0, tack_vitesse_cm: 0,
        tack_frequence: '', tack_type_gaz: 'CO2', tack_debit_gaz: '',
        soudure_vitesse_m: 0, soudure_vitesse_cm: 0,
        soudure_type_fil: '1.6mm', soudure_type_flux: 'SAW',
        notes: ''
      });
      setEditHeads(JSON.parse(JSON.stringify(DEFAULT_HEADS)));
    }
    setParametreMode('edit');
  };

  const handleSelectPreset = async () => {
    if (!selectedPresetId) return;
    setSavingParam(true);
    try {
      await api.put(`/coulees/${coulee.id}/parametres`, { action: 'select', parametre_id: Number(selectedPresetId) });
      showToast(t('coulees.msg_maj'), 'success');
      setParametreMode(null);
      setSelectedPresetId('');
      onRefresh();
    } catch (e) { showToast('Erreur', 'error'); }
    finally { setSavingParam(false); }
  };

  const handleSaveModifiedPreset = async () => {
    setSavingParam(true);
    try {
      await api.put(`/coulees/${coulee.id}/parametres`, {
        action: 'create',
        parametres: { ...editForm, heads: editHeads }
      });
      showToast(t('coulees.msg_maj'), 'success');
      setParametreMode(null);
      onRefresh();
      if (onPresetsChange) onPresetsChange();
    } catch (e) { showToast('Erreur création preset', 'error'); }
    finally { setSavingParam(false); }
  };

  const updateStep = async (endpoint, body = {}) => {
    setLoading(true);
    try {
      await api.put(`/coulees/${coulee.id}/${endpoint}`, body);
      showToast(t('coulees.msg_maj'), 'success');
      onRefresh();
    } catch (error) {
      showToast('Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helpers pour le calcul et l'affichage des retards
  const formatDelay = (mins) => {
    if (mins < 60) return `${mins}mn`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}mn` : `${h}h`;
  };

  const getDelayStyle = (mins) => {
    if (mins < 5) return { color: 'text-blue-600', bg: 'bg-blue-50', iconColor: 'text-green-500', Icon: CheckCircle };
    if (mins < 10) return { color: 'text-orange-600', bg: 'bg-orange-50', iconColor: 'text-orange-500', Icon: AlertTriangle };
    return { color: 'text-red-600', bg: 'bg-red-50', iconColor: 'text-red-500', Icon: AlertTriangle };
  };

  const handleReception = () => {
    const startTime = new Date(coulee.created_at).getTime();
    const delayMs = Date.now() - startTime;
    const delayMinutes = Math.round(delayMs / 60000);

    if (delayMinutes >= 10) {
      setRetardData({ minutes: delayMinutes, motif_id: '', commentaire: '' });
      setShowRetardForm('reception');
    } else {
      updateStep('reception', { recue: true, retard_minutes: delayMinutes });
    }
  };

  const handleInstallation = () => {
    const startTime = new Date(coulee.date_reception).getTime();
    const delayMs = Date.now() - startTime;
    const delayMinutes = Math.round(delayMs / 60000);

    if (delayMinutes >= 10) {
      setRetardData({ minutes: delayMinutes, motif_id: '', commentaire: '' });
      setShowRetardForm('installation');
    } else {
      updateStep('installation', { installee: true, retard_minutes: delayMinutes });
    }
  };

  const confirmRetard = () => {
    const endpoint = showRetardForm;
    const body = {
      [endpoint === 'reception' ? 'recue' : 'installee']: true,
      retard_minutes: parseInt(retardData.minutes) || 0,
      motif_retard_id: retardData.motif_id || null,
      commentaire: retardData.commentaire || null
    };
    updateStep(endpoint, body);
    setShowRetardForm(null);
    setRetardData({ minutes: 0, motif_id: '', commentaire: '' });
  };

  const statut = STATUTS[coulee.statut] || STATUTS.en_cours;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-amber-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Coulée N°<span className="font-mono">{coulee.numero}</span></h2>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statut.color}`}>
              {t(statut.labelKey)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Résumé Temps & Retards */}
        {coulee.created_at && (
          <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Démarrée le {new Date(coulee.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {(coulee.retard_reception_minutes > 0) && (
              <div className={`flex items-center gap-1.5 font-medium ${getDelayStyle(coulee.retard_reception_minutes).color}`}>
                <Truck className="w-4 h-4" />
                <span>Réception : {formatDelay(coulee.retard_reception_minutes)}</span>
              </div>
            )}
            {(coulee.retard_installation_minutes > 0) && (
              <div className={`flex items-center gap-1.5 font-medium ${getDelayStyle(coulee.retard_installation_minutes).color}`}>
                <Wrench className="w-4 h-4" />
                <span>Installation : {formatDelay(coulee.retard_installation_minutes)}</span>
              </div>
            )}
            {((coulee.retard_reception_minutes || 0) + (coulee.retard_installation_minutes || 0)) > 0 && (coulee.retard_reception_minutes > 0 && coulee.retard_installation_minutes > 0) && (
              <div className={`flex items-center gap-1.5 font-bold ${getDelayStyle((coulee.retard_reception_minutes || 0) + (coulee.retard_installation_minutes || 0)).color}`}>
                <AlertTriangle className="w-4 h-4" />
                <span>Total : {formatDelay((coulee.retard_reception_minutes || 0) + (coulee.retard_installation_minutes || 0))}</span>
              </div>
            )}
          </div>
        )}

        {/* Workflow Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Étape 1: Bobine sélectionnée */}
          <WorkflowStep
            number={1}
            title={t('coulees.bobine_selectionnee')}
            icon={Package}
            done={!!coulee.bobine_id}
            active={!coulee.bobine_id}
          >
            {coulee.bobine_id ? (
              <div className="space-y-2">
                {coulee.created_at && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">Coulée démarrée le {new Date(coulee.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 bg-green-50 p-3 rounded-lg">
                  <Package className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="font-bold text-gray-900">{coulee.bobine_numero}</div>
                    <div className="text-sm text-gray-600">
                      {coulee.bobine_epaisseur}mm × {coulee.bobine_largeur}mm - {coulee.bobine_poids}kg
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">Aucune bobine sélectionnée</p>
                <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">
                  Sélectionner une bobine
                </button>
              </div>
            )}
          </WorkflowStep>

          {/* Étape 2: Bobine reçue */}
          <WorkflowStep
            number={2}
            title={t('coulees.bobine_recue')}
            icon={Truck}
            done={coulee.bobine_recue}
            active={!!coulee.bobine_id && !coulee.bobine_recue}
            retard={coulee.retard_reception_minutes}
            motif={coulee.motif_reception_libelle}
          >
            {coulee.bobine_recue ? (
              (() => {
                const delay = coulee.retard_reception_minutes || 0;
                const style = getDelayStyle(delay);
                const DelayIcon = style.Icon;
                return (
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 ${style.color}`}>
                      <DelayIcon className={`w-5 h-5 ${style.iconColor}`} />
                      <span>Bobine reçue le {new Date(coulee.date_reception).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {delay > 0 && <span className="font-semibold">— {formatDelay(delay)} de retard</span>}
                    </div>
                    {delay >= 10 && coulee.motif_reception_libelle && (
                      <div className="text-sm text-red-500 ml-7 italic">Motif : {coulee.motif_reception_libelle}</div>
                    )}
                    {delay >= 10 && coulee.commentaire_reception && (
                      <div className="text-xs text-gray-500 ml-7">{coulee.commentaire_reception}</div>
                    )}
                  </div>
                );
              })()
            ) : coulee.bobine_id ? (
              <button
                onClick={handleReception}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
              >
                <Check className="w-4 h-4" /> Bobine reçue
              </button>
            ) : (
              <p className="text-gray-400 italic">Sélectionnez d'abord une bobine</p>
            )}
          </WorkflowStep>

          {/* Étape 3: Bobine installée */}
          <WorkflowStep
            number={3}
            title={t('coulees.bobine_installee')}
            icon={Wrench}
            done={coulee.bobine_installee}
            active={coulee.bobine_recue && !coulee.bobine_installee}
            retard={coulee.retard_installation_minutes}
            motif={coulee.motif_installation_libelle}
          >
            {coulee.bobine_installee ? (
              (() => {
                const delay = coulee.retard_installation_minutes || 0;
                const style = getDelayStyle(delay);
                const DelayIcon = style.Icon;
                return (
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 ${style.color}`}>
                      <DelayIcon className={`w-5 h-5 ${style.iconColor}`} />
                      <span>Bobine installée le {new Date(coulee.date_installation).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {delay > 0 && <span className="font-semibold">— {formatDelay(delay)} de retard</span>}
                    </div>
                    {delay >= 10 && coulee.motif_installation_libelle && (
                      <div className="text-sm text-red-500 ml-7 italic">Motif : {coulee.motif_installation_libelle}</div>
                    )}
                    {delay >= 10 && coulee.commentaire_installation && (
                      <div className="text-xs text-gray-500 ml-7">{coulee.commentaire_installation}</div>
                    )}
                  </div>
                );
              })()
            ) : coulee.bobine_recue ? (
              <button
                onClick={handleInstallation}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
              >
                <Check className="w-4 h-4" /> Bobine installée
              </button>
            ) : (
              <p className="text-gray-400 italic">La bobine doit être reçue d'abord</p>
            )}
          </WorkflowStep>

          {/* Étape 4: Checklist Machine */}
          <WorkflowStep
            number={4}
            title={t('coulees.checklist_machine')}
            icon={ClipboardCheck}
            done={!!coulee.checklist_validee}
            active={!!coulee.bobine_installee && !coulee.checklist_validee}
          >
            {coulee.checklist_validee ? (
              <div className="space-y-2">
                <div className="text-green-600 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Validée le {coulee.date_checklist && new Date(coulee.date_checklist).toLocaleString('fr-FR')}
                </div>
                {!!coulee.checklist_validation_rapide && (
                  <div className="text-xs text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg w-fit">
                    <RefreshCw className="w-3 h-3" />
                    Validation rapide {coulee.checklist_source_coulee_id && `(reprise coulée N°${coulee.source_coulee_numero || coulee.checklist_source_coulee_id})`}
                  </div>
                )}
              </div>
            ) : coulee.bobine_installee ? (
              <div className="space-y-3">
                {/* Info dernière validation */}
                {derniereValidation?.exists && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock className="w-4 h-4" />
                      <span>Dernière validation : <strong>Coulée N°{derniereValidation.coulee_numero}</strong></span>
                    </div>
                    <div className="text-blue-600 text-xs mt-1 ml-6">
                      {derniereValidation.date && (() => {
                        const d = new Date(derniereValidation.date);
                        const now = new Date();
                        const diff = Math.round((now - d) / 60000);
                        if (diff < 60) return `il y a ${diff} min`;
                        if (diff < 1440) return `il y a ${Math.floor(diff/60)}h`;
                        return `le ${d.toLocaleString('fr-FR')}`;
                      })()}
                      {derniereValidation.validateur && ` par ${derniereValidation.validateur}`}
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                <div className="flex gap-2">
                  {derniereValidation?.exists && (
                    <button
                      onClick={handleValidationRapide}
                      disabled={validationRapideLoading || loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium"
                    >
                      {validationRapideLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {t('coulees.validation_rapide')}
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/checklist-machine/${coulee.id}`)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium ${derniereValidation?.exists ? '' : 'flex-1'}`}
                  >
                    <ClipboardCheck className="w-4 h-4" /> {t('coulees.ouvrir_checklist')}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 italic">La bobine doit être installée d'abord</p>
            )}
          </WorkflowStep>

          {/* Étape 5: Démarrer Production */}
          {!!coulee.checklist_validee && coulee.statut === 'pret_production' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <Play className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h3 className="font-bold text-green-700 text-lg">{t('coulees.pret_production')}</h3>
              <p className="text-green-600 text-sm mb-4">Checklist validée, vous pouvez lancer la production</p>
              <button
                onClick={async () => {
                  await updateStep('demarrer-production');
                  // Si une autre coulée est déjà en production, aller vers la liste des tubes seulement
                  const autreCouleeActive = coulees.some(c => c.id !== coulee.id && c.statut === 'en_production');
                  if (autreCouleeActive) {
                    navigate('/tubes');
                  } else {
                    navigate(`/tubes?coulee_id=${coulee.id}&new_tube=1`);
                  }
                }}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 mx-auto"
              >
                <Play className="w-5 h-5" /> {t('coulees.demarrer_production')}
              </button>
            </div>
          )}

          {coulee.statut === 'en_production' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
              <Play className="w-12 h-12 text-orange-500 mx-auto mb-2" />
              <h3 className="font-bold text-orange-700 text-lg">{t('coulees.production_en_cours')}</h3>
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => navigate('/tubes')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Cylinder className="w-5 h-5" /> {t('coulees.voir_tubes')}
                </button>
                <button
                  onClick={() => updateStep('terminer')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <Square className="w-5 h-5" /> {t('coulees.terminer_coulee')}
                </button>
              </div>
            </div>
          )}

          {/* Section Paramètres de Production */}
          <div className="border border-violet-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-600" />
                <span className="font-medium text-violet-800">{t('coulees.parametres_production')}</span>
                {coulee.parametre_numero && (
                  <span className="font-mono text-sm bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-300">
                    {coulee.parametre_numero}
                  </span>
                )}
              </div>
              {coulee.statut !== 'termine' && parametreMode === null && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setParametreMode('select'); setSelectedPresetId(''); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200 border border-violet-300"
                  >
                    <ChevronDown className="w-3 h-3" /> {t('coulees.changer')}
                  </button>
                  <button
                    onClick={loadPresetForEdit}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 border border-amber-300"
                  >
                    <Edit3 className="w-3 h-3" /> {t('common.modifier')}
                  </button>
                </div>
              )}
              {parametreMode !== null && (
                <button
                  onClick={() => setParametreMode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-4">
              {/* Affichage résumé quand rien n'est en mode */}
              {parametreMode === null && (
                coulee.parametre_id ? (
                  <ParametreResume coulee={coulee} presets={presets} />
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <Settings className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">{t('coulees.aucun_preset')}</p>
                    <button
                      onClick={() => { setParametreMode('select'); setSelectedPresetId(''); }}
                      className="mt-2 text-violet-600 hover:underline text-sm"
                    >
                      {t('coulees.associer_preset')}
                    </button>
                  </div>
                )
              )}

              {/* Mode sélection */}
              {parametreMode === 'select' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Sélectionner un preset existant :</p>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 text-sm"
                  >
                    <option value="">{t('coulees.choisir_preset')}</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.numero} — Strip {p.strip_vitesse_m}m{String(p.strip_vitesse_cm).padStart(2,'0')} | Tack {p.tack_amperage}A/{p.tack_voltage}V
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setParametreMode(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      {t('common.annuler')}
                    </button>
                    <button
                      onClick={handleSelectPreset}
                      disabled={!selectedPresetId || savingParam}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> Appliquer
                    </button>
                  </div>
                </div>
              )}

              {/* Mode édition */}
              {parametreMode === 'edit' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    La sauvegarde créera un <strong>nouveau preset</strong> (traçabilité). L'ancien preset reste inchangé.
                  </div>

                  {/* Formage */}
                  <ParamSection title="Formage" color="blue" open={openSections.formage} onToggle={() => setOpenSections(s => ({...s, formage: !s.formage}))}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Strip Speed</label>
                        <div className="flex gap-1">
                          <div className="flex-1">
                            <input type="number" value={editForm.strip_vitesse_m} onChange={e => setEditForm(f => ({...f, strip_vitesse_m: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" />
                            <span className="text-xs text-gray-400">m</span>
                          </div>
                          <div className="flex-1">
                            <input type="number" value={editForm.strip_vitesse_cm} onChange={e => setEditForm(f => ({...f, strip_vitesse_cm: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" max="99" />
                            <span className="text-xs text-gray-400">cm</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Pression rouleaux</label>
                        <div className="flex gap-1">
                          <input type="number" value={editForm.pression_rouleaux} onChange={e => setEditForm(f => ({...f, pression_rouleaux: e.target.value}))} className="flex-1 px-2 py-1.5 border rounded text-sm" />
                          <select value={editForm.pression_rouleaux_unite} onChange={e => setEditForm(f => ({...f, pression_rouleaux_unite: e.target.value}))} className="px-2 py-1.5 border rounded text-xs">
                            <option value="tonnes">t</option>
                            <option value="bars">bar</option>
                            <option value="psi">psi</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Milling gauche (°)</label>
                        <input type="number" value={editForm.milling_edge_gauche} onChange={e => setEditForm(f => ({...f, milling_edge_gauche: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Milling droit (°)</label>
                        <input type="number" value={editForm.milling_edge_droit} onChange={e => setEditForm(f => ({...f, milling_edge_droit: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                    </div>
                  </ParamSection>

                  {/* Tackwelding */}
                  <ParamSection title="Tackwelding" color="amber" open={openSections.tack} onToggle={() => setOpenSections(s => ({...s, tack: !s.tack}))}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ampérage (A)</label>
                        <input type="number" value={editForm.tack_amperage} onChange={e => setEditForm(f => ({...f, tack_amperage: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Voltage (V)</label>
                        <input type="number" value={editForm.tack_voltage} onChange={e => setEditForm(f => ({...f, tack_voltage: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vitesse tack</label>
                        <div className="flex gap-1">
                          <input type="number" value={editForm.tack_vitesse_m} onChange={e => setEditForm(f => ({...f, tack_vitesse_m: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" />
                          <input type="number" value={editForm.tack_vitesse_cm} onChange={e => setEditForm(f => ({...f, tack_vitesse_cm: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" max="99" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fréquence</label>
                        <input type="number" value={editForm.tack_frequence} onChange={e => setEditForm(f => ({...f, tack_frequence: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type gaz</label>
                        <select value={editForm.tack_type_gaz} onChange={e => setEditForm(f => ({...f, tack_type_gaz: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm">
                          {GAZ_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Débit gaz (L/min)</label>
                        <input type="number" value={editForm.tack_debit_gaz} onChange={e => setEditForm(f => ({...f, tack_debit_gaz: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" />
                      </div>
                    </div>
                  </ParamSection>

                  {/* Soudure Finale */}
                  <ParamSection title="Soudure Finale" color="orange" open={openSections.soudure} onToggle={() => setOpenSections(s => ({...s, soudure: !s.soudure}))}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Vitesse soudure</label>
                        <div className="flex gap-1">
                          <input type="number" value={editForm.soudure_vitesse_m} onChange={e => setEditForm(f => ({...f, soudure_vitesse_m: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" />
                          <input type="number" value={editForm.soudure_vitesse_cm} onChange={e => setEditForm(f => ({...f, soudure_vitesse_cm: Number(e.target.value)}))} className="w-full px-2 py-1.5 border rounded text-sm" min="0" max="99" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type fil</label>
                        <select value={editForm.soudure_type_fil} onChange={e => setEditForm(f => ({...f, soudure_type_fil: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm">
                          {FIL_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type flux</label>
                        <select value={editForm.soudure_type_flux} onChange={e => setEditForm(f => ({...f, soudure_type_flux: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm">
                          {FLUX_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* Têtes de soudure */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600">Têtes de soudure</label>
                      {editHeads.map((head, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="w-12 text-xs font-mono text-gray-500">{head.type} #{head.numero}</span>
                          <button type="button" onClick={() => {
                            const updated = [...editHeads];
                            updated[idx] = {...updated[idx], actif: !updated[idx].actif};
                            setEditHeads(updated);
                          }}>
                            {head.actif ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                          </button>
                          {head.actif && (
                            <>
                              <input type="number" value={head.amperage} onChange={e => { const u = [...editHeads]; u[idx] = {...u[idx], amperage: Number(e.target.value)}; setEditHeads(u); }} className="w-16 px-2 py-1 border rounded text-sm" placeholder="A" />
                              <span className="text-xs text-gray-400">A</span>
                              <input type="number" value={head.voltage} onChange={e => { const u = [...editHeads]; u[idx] = {...u[idx], voltage: Number(e.target.value)}; setEditHeads(u); }} className="w-16 px-2 py-1 border rounded text-sm" placeholder="V" />
                              <span className="text-xs text-gray-400">V</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </ParamSection>

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                    <textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} className="w-full px-2 py-1.5 border rounded text-sm" rows={2} placeholder={t('coulees.notes_optionnelles')} />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setParametreMode(null)} className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                      {t('common.annuler')}
                    </button>
                    <button
                      onClick={handleSaveModifiedPreset}
                      disabled={savingParam}
                      className="flex items-center gap-1 px-4 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> {t('coulees.creer_appliquer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {t('coulees.cree_par')} {coulee.operateur_prenom} {coulee.operateur_nom}
          </div>
          <div className="flex gap-2">
            {coulee.statut !== 'en_production' && coulee.statut !== 'termine' && 
             !!(coulee.bobine_recue || coulee.bobine_installee || coulee.checklist_validee) && (
              <button
                onClick={async () => {
                  const confirmed = await confirmReset('Réinitialisation', 'toutes les étapes validées');
                  if (confirmed) {
                    updateStep('reinitialiser');
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> {t('coulees.reinitialiser')}
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              {t('common.fermer')}
            </button>
          </div>
        </div>

        {/* Modal Retard */}
        {showRetardForm && (
          <RetardModal
            type={showRetardForm}
            motifs={motifsRetard[showRetardForm] || []}
            data={retardData}
            onChange={setRetardData}
            onConfirm={confirmRetard}
            onCancel={() => setShowRetardForm(null)}
          />
        )}
      </div>
    </div>
  );
}

// Résumé compact des paramètres
function ParametreResume({ coulee, presets }) {
  const preset = presets?.find(p => p.id === coulee.parametre_id);
  if (!preset) return <p className="text-sm text-gray-500">Preset introuvable</p>;
  const activeHeads = (preset.heads || []).filter(h => h.actif);
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <span className="text-xs text-gray-500 block">Strip Speed</span>
        <span className="font-medium">{preset.strip_vitesse_m}m{String(preset.strip_vitesse_cm).padStart(2,'0')}</span>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Milling</span>
        <span className="font-medium">{preset.milling_edge_gauche}° / {preset.milling_edge_droit}°</span>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Tack</span>
        <span className="font-medium">{preset.tack_amperage}A / {preset.tack_voltage}V</span>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Soudure Speed</span>
        <span className="font-medium">{preset.soudure_vitesse_m}m{String(preset.soudure_vitesse_cm).padStart(2,'0')}</span>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Fil / Flux</span>
        <span className="font-medium">{preset.soudure_type_fil} / {preset.soudure_type_flux}</span>
      </div>
      <div>
        <span className="text-xs text-gray-500 block">Têtes</span>
        <span className="font-medium">{activeHeads.length} actives</span>
      </div>
    </div>
  );
}

// Section paramètre (mini accordion)
function ParamSection({ title, color, open, onToggle, children }) {
  const colorMap = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`border ${c.border} rounded-lg overflow-hidden`}>
      <button type="button" onClick={onToggle} className={`w-full flex items-center justify-between px-3 py-2 ${c.bg}`}>
        <span className={`text-sm font-medium ${c.text}`}>{title}</span>
        {open ? <ChevronUp className={`w-4 h-4 ${c.icon}`} /> : <ChevronDown className={`w-4 h-4 ${c.icon}`} />}
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

// Étape du workflow
function WorkflowStep({ number, title, icon: Icon, done, active, retard, motif, children }) {
  return (
    <div className={`border rounded-lg overflow-hidden ${
      done ? 'border-green-300 bg-green-50/50' : 
      active ? 'border-amber-300 bg-amber-50/50' : 
      'border-gray-200 bg-gray-50/50'
    }`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${
        done ? 'bg-green-100' : active ? 'bg-amber-100' : 'bg-gray-100'
      }`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
          done ? 'bg-green-500' : active ? 'bg-amber-500' : 'bg-gray-400'
        }`}>
          {done ? <Check className="w-5 h-5" /> : number}
        </div>
        <Icon className={`w-5 h-5 ${done ? 'text-green-600' : active ? 'text-amber-600' : 'text-gray-400'}`} />
        <span className={`font-medium ${done ? 'text-green-800' : active ? 'text-amber-800' : 'text-gray-600'}`}>
          {title}
        </span>
        {retard > 0 && (
          <span className={`ml-auto text-sm flex items-center gap-1 ${
            retard < 5 ? 'text-blue-600' : retard < 10 ? 'text-orange-600' : 'text-red-600'
          }`}>
            {retard < 5 ? <CheckCircle className="w-4 h-4 text-green-500" /> :
             retard < 10 ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
             <AlertTriangle className="w-4 h-4 text-red-500" />}
            +{retard < 60 ? `${retard}mn` : `${Math.floor(retard/60)}h${retard%60 > 0 ? retard%60 + 'mn' : ''}`} {motif && `(${motif})`}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Modal Retard
function RetardModal({ type, motifs, data, onChange, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const initTotal = data.minutes || 0;
  const [jours, setJours] = useState(Math.floor(initTotal / (24 * 60)));
  const [heures, setHeures] = useState(Math.floor((initTotal % (24 * 60)) / 60));
  const [minutes, setMinutes] = useState(initTotal % 60);

  // Calculer le total en minutes
  const totalMinutes = (parseInt(jours) || 0) * 24 * 60 + (parseInt(heures) || 0) * 60 + (parseInt(minutes) || 0);

  // Mettre à jour le parent quand les valeurs changent
  const updateTotal = (j, h, m) => {
    const total = (parseInt(j) || 0) * 24 * 60 + (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
    onChange({ ...data, minutes: total });
  };

  const handleJoursChange = (v) => { setJours(v); updateTotal(v, heures, minutes); };
  const handleHeuresChange = (v) => { setHeures(v); updateTotal(jours, v, minutes); };
  const handleMinutesChange = (v) => { setMinutes(v); updateTotal(jours, heures, v); };

  // Formater le temps pour l'affichage
  const formatDuree = (mins) => {
    if (!mins) return '';
    const j = Math.floor(mins / (24 * 60));
    const h = Math.floor((mins % (24 * 60)) / 60);
    const m = mins % 60;
    const parts = [];
    if (j > 0) parts.push(`${j} jour${j > 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} heure${h > 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minute${m > 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          {t('coulees.retard_titre')}
        </h3>

        {initTotal > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            <Clock className="w-4 h-4" />
            <span>Retard calculé automatiquement : <strong>{formatDuree(initTotal)}</strong></span>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('coulees.duree_retard')}</label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('coulees.jours')}</label>
                <input
                  type="number"
                  value={jours}
                  onChange={(e) => handleJoursChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('coulees.heures')}</label>
                <input
                  type="number"
                  value={heures}
                  onChange={(e) => handleHeuresChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center"
                  min="0"
                  max="23"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('coulees.minutes')}</label>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => handleMinutesChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-center"
                  min="0"
                  max="59"
                  placeholder="0"
                />
              </div>
            </div>
            {totalMinutes > 0 && (
              <p className="text-sm text-orange-600 mt-2 font-medium">
                Total: {formatDuree(totalMinutes)} ({totalMinutes} min)
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('coulees.motif_retard')}</label>
            <select
              value={data.motif_id}
              onChange={(e) => onChange({ ...data, motif_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="">{t('coulees.selectionner_motif')}</option>
              {motifs.map(m => (
                <option key={m.id} value={m.id}>{m.libelle}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('coulees.commentaire')}</label>
            <textarea
              value={data.commentaire}
              onChange={(e) => onChange({ ...data, commentaire: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            {t('common.annuler')}
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            {t('common.confirmer')}
          </button>
        </div>
      </div>
    </div>
  );
}
