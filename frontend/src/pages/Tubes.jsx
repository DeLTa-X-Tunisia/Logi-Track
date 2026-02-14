/**
 * Page Tubes - Suivi de production des tubes spirale
 * Timeline 12 étapes avec gestion non-conformité et étapes offline
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, X, Check, Clock, AlertTriangle, Eye, Trash2,
  Play, Cylinder, Flame, Scissors, Scan, Droplet, ChevronDown,
  ChevronUp, ChevronRight, Package, Filter, SkipForward,
  AlertOctagon, RotateCcw, Ban, ShieldCheck, MessageSquare, Wifi, WifiOff,
  Settings, Edit3, ToggleRight, ToggleLeft, Save, Award, Wrench, Trophy,
  Camera, ImageIcon, ZoomIn, Download, FileText
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Constantes - 12 étapes de production
// ============================================
const ETAPES = [
  { numero: 1,  code: 'FORMAGE',      nom: 'Formage',                       icon: Cylinder,  color: 'blue',   offline: false },
  { numero: 2,  code: 'POINTAGE',     nom: 'Pointage (GMAW)',               icon: Flame,     color: 'orange', offline: false },
  { numero: 3,  code: 'CV_POINTAGE',  nom: 'CV Pointage',                   icon: Eye,       color: 'purple', offline: false },
  { numero: 4,  code: 'SAW_ID_OD',    nom: 'SAW ID/OD',                     icon: Flame,     color: 'amber',  offline: true  },
  { numero: 5,  code: 'CV_CORDON',    nom: 'CV Cordon',                     icon: Eye,       color: 'purple', offline: false },
  { numero: 6,  code: 'COUPE',        nom: 'Coupe',                         icon: Scissors,  color: 'green',  offline: false },
  { numero: 7,  code: 'CND',          nom: 'CND',                           icon: Scan,      color: 'red',    offline: false },
  { numero: 8,  code: 'CV_APRES_CND', nom: 'CV après CND',                  icon: Eye,       color: 'purple', offline: false },
  { numero: 9,  code: 'HYDROTEST',    nom: 'Hydrotest',                     icon: Droplet,   color: 'cyan',   offline: false },
  { numero: 10, code: 'CV_FUITE',     nom: 'CV Fuite',                      icon: Eye,       color: 'purple', offline: false },
  { numero: 11, code: 'CHANFREIN',    nom: 'Chanfrein',                     icon: Scissors,  color: 'green',  offline: false },
  { numero: 12, code: 'CV_CHANFREIN', nom: 'CV Chanfrein',                  icon: Eye,       color: 'purple', offline: false },
];

const STATUT_COLORS = {
  en_production: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En production', icon: Play },
  termine: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminé', icon: Check },
  en_attente: { bg: 'bg-red-100', text: 'text-red-700', label: 'Bloqué (NC)', icon: AlertOctagon },
  rebut: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rebut', icon: Ban },
};

// Formatter une durée en texte lisible
function formatDuration(ms) {
  if (!ms || ms < 0) return '-';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

// Calculer durée d'une étape (started_at -> completed_at)
function getEtapeDuration(etape) {
  if (!etape?.started_at || !etape?.completed_at) return null;
  return new Date(etape.completed_at) - new Date(etape.started_at);
}

// Calculer délai inter-étape (completed_at étape N -> started_at étape N+1)
function getInterDelay(prevEtape, nextEtape) {
  if (!prevEtape?.completed_at || !nextEtape?.started_at) return null;
  return new Date(nextEtape.started_at) - new Date(prevEtape.completed_at);
}

const ETAPE_STATUT_COLORS = {
  en_attente:    { bg: 'bg-gray-200',   ring: 'ring-gray-300',   text: 'text-gray-400' },
  en_cours:      { bg: 'bg-blue-500',   ring: 'ring-blue-400',   text: 'text-white' },
  valide:        { bg: 'bg-green-500',  ring: 'ring-green-400',  text: 'text-white' },
  non_conforme:  { bg: 'bg-red-500',    ring: 'ring-red-400',    text: 'text-white' },
  saute:         { bg: 'bg-amber-400',  ring: 'ring-amber-300',  text: 'text-white' },
};

const DECISION_INFO = {
  en_attente:            { label: 'En attente',           badge: '⏳', bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300' },
  certifie_api:          { label: 'Certifié API',         badge: '🏆', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  certifie_hydraulique:  { label: 'Certifié Hydraulique', badge: '🔧', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300' },
  declasse:              { label: 'Déclassé',             badge: '⚠️', bg: 'bg-orange-100',  text: 'text-orange-700', border: 'border-orange-300' },
};

const DIAMETRES = [
  { pouce: '8"',  mm: 219.1  }, { pouce: '10"', mm: 273.1  }, { pouce: '12"', mm: 323.9  },
  { pouce: '14"', mm: 355.6  }, { pouce: '16"', mm: 406.4  }, { pouce: '18"', mm: 457.2  },
  { pouce: '20"', mm: 508.0  }, { pouce: '22"', mm: 558.8  }, { pouce: '24"', mm: 609.6  },
  { pouce: '26"', mm: 660.4  }, { pouce: '28"', mm: 711.2  }, { pouce: '30"', mm: 762.0  },
  { pouce: '32"', mm: 812.8  }, { pouce: '34"', mm: 863.6  }, { pouce: '36"', mm: 914.4  },
  { pouce: '38"', mm: 965.2  }, { pouce: '40"', mm: 1016.0 }, { pouce: '42"', mm: 1066.8 },
  { pouce: '44"', mm: 1117.6 }, { pouce: '46"', mm: 1168.4 }, { pouce: '48"', mm: 1219.2 },
  { pouce: '52"', mm: 1320.8 }, { pouce: '56"', mm: 1422.4 }, { pouce: '60"', mm: 1524.0 },
  { pouce: '64"', mm: 1625.6 }, { pouce: '68"', mm: 1727.2 }, { pouce: '72"', mm: 1828.8 },
  { pouce: '76"', mm: 1930.4 }, { pouce: '80"', mm: 2032.0 }, { pouce: '82"', mm: 2082.8 },
];

// ============================================
// Composant principal
// ============================================
export default function Tubes() {
  const { showToast } = useToast();
  const { confirmDelete } = useConfirm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tubes, setTubes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterEtape, setFilterEtape] = useState('');
  const [filterDecision, setFilterDecision] = useState('');
  const [filterCoulee, setFilterCoulee] = useState(searchParams.get('coulee_id') || '');
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTube, setSelectedTube] = useState(null);
  const [coulees, setCoulees] = useState([]);

  // Sync filter with URL changes (navigation from Coulées)
  useEffect(() => {
    const isNewTube = searchParams.get('new_tube') === '1';
    const highlightTubeId = searchParams.get('highlight');
    // Ne pas filtrer par coulée quand on vient de Démarrer Production
    // pour afficher tous les tubes en cours
    if (!isNewTube) {
      const urlCoulee = searchParams.get('coulee_id') || '';
      setFilterCoulee(urlCoulee);
    } else {
      setFilterCoulee('');
    }
    // Auto-open Nouveau Tube modal when coming from "Démarrer Production"
    if (isNewTube) {
      setShowNewModal(true);
      // Clean up URL params to avoid re-opening on refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
    // Ouvrir directement un tube depuis une notification
    if (highlightTubeId) {
      (async () => {
        try {
          const response = await api.get(`/tubes/${highlightTubeId}`);
          setSelectedTube(response.data);
        } catch (e) {
          console.error('Erreur chargement tube depuis notification:', e);
        }
      })();
      // Nettoyer l'URL pour éviter re-ouverture au refresh
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // Fetch data
  const fetchTubes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterStatut) params.append('statut', filterStatut);
      if (filterEtape) params.append('etape', filterEtape);
      if (filterCoulee) params.append('coulee_id', filterCoulee);
      if (filterDecision) params.append('decision', filterDecision);

      const response = await api.get(`/tubes?${params}`);
      setTubes(response.data);
    } catch (e) { console.error(e); }
  }, [search, filterStatut, filterEtape, filterCoulee, filterDecision]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/tubes/stats');
      setStats(response.data);
    } catch (e) { console.error(e); }
  };

  const fetchCoulees = async () => {
    try {
      const response = await api.get('/coulees');
      setCoulees(response.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTubes(), fetchStats(), fetchCoulees()]);
      setLoading(false);
    };
    init();
  }, [fetchTubes]);

  // Refresh après action
  const refresh = async () => {
    await Promise.all([fetchTubes(), fetchStats()]);
  };

  // Ouvrir détail tube
  const openDetail = async (tubeId) => {
    try {
      const response = await api.get(`/tubes/${tubeId}`);
      setSelectedTube(response.data);
    } catch (e) {
      showToast('Erreur chargement tube', 'error');
    }
  };

  // Supprimer un tube
  const handleDelete = async (tubeId) => {
    const ok = await confirmDelete('Supprimer ce tube ?', 'Cette action est irréversible.');
    if (!ok) return;
    try {
      await api.delete(`/tubes/${tubeId}`);
      showToast('Tube supprimé', 'success');
      refresh();
    } catch (e) {
      showToast('Erreur suppression', 'error');
    }
  };

  // ============================================
  // RENDU
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tubes</h1>
          <p className="text-gray-500 mt-1">Suivi de production — 12 étapes API 5L</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" /> Nouveau tube
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total tubes" value={stats.total || 0} color="bg-primary-500" icon={Package} />
        <StatCard label="En production" value={stats.en_production || 0} color="bg-blue-500" icon={Play} />
        <StatCard label="Terminés" value={stats.termines || 0} color="bg-green-500" icon={Check} />
        <StatCard label="Non-conformes" value={stats.non_conformes || 0} color="bg-red-500" icon={AlertOctagon} />
        <StatCard label="Rebuts" value={stats.rebuts || 0} color="bg-gray-500" icon={Ban} />
      </div>

      {/* Stats Décisions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="⏳ Décision en attente" value={stats.decision_en_attente || 0} color="bg-amber-500" icon={Clock} />
        <StatCard label="🏆 Certifié API" value={stats.certifie_api || 0} color="bg-emerald-500" icon={Trophy} />
        <StatCard label="🔧 Certifié Hydraulique" value={stats.certifie_hydraulique || 0} color="bg-blue-500" icon={Wrench} />
        <StatCard label="⚠️ Déclassé" value={stats.declasse || 0} color="bg-orange-500" icon={AlertTriangle} />
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par N° tube ou coulée..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les statuts</option>
            <option value="en_production">En production</option>
            <option value="termine">Terminé</option>
            <option value="en_attente">Bloqué (NC)</option>
            <option value="rebut">Rebut</option>
          </select>
          <select
            value={filterEtape}
            onChange={e => setFilterEtape(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes les étapes</option>
            {ETAPES.map(e => (
              <option key={e.numero} value={e.numero}>{e.numero}. {e.nom}</option>
            ))}
          </select>
          <select
            value={filterDecision}
            onChange={e => setFilterDecision(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Toutes décisions</option>
            <option value="en_attente">⏳ En attente</option>
            <option value="certifie_api">🏆 Certifié API</option>
            <option value="certifie_hydraulique">🔧 Certifié Hydraulique</option>
            <option value="declasse">⚠️ Déclassé</option>
          </select>
        </div>
      </div>

      {/* Liste des tubes */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : tubes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Cylinder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600">Aucun tube</h3>
          <p className="text-gray-400 mt-1">Créez votre premier tube pour commencer le suivi de production</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tubes.map(tube => (
            <TubeCard
              key={tube.id}
              tube={tube}
              onClick={() => openDetail(tube.id)}
              onDelete={() => handleDelete(tube.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewTubeModal
          onClose={() => setShowNewModal(false)}
          onCreated={(tube) => {
            setShowNewModal(false);
            refresh();
            openDetail(tube.id);
            showToast(`Tube N°${tube.numero} créé`, 'success');
          }}
        />
      )}

      {selectedTube && (
        <TubeDetailModal
          tube={selectedTube}
          onClose={() => setSelectedTube(null)}
          onUpdate={(updatedTube) => {
            setSelectedTube(updatedTube);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// StatCard
// ============================================
function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// ============================================
// TubeCard - Carte avec timeline horizontale
// ============================================
function TubeCard({ tube, onClick, onDelete }) {
  const statutInfo = STATUT_COLORS[tube.statut] || STATUT_COLORS.en_production;
  const etapesValidees = (tube.etapes || []).filter(e => e.statut === 'valide').length;
  const etapeCourante = ETAPES.find(e => e.numero === tube.etape_courante);
  const hasNC = (tube.etapes || []).some(e => e.statut === 'non_conforme');
  const hasSaute = (tube.etapes || []).some(e => e.statut === 'saute');

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all cursor-pointer ${
        tube.statut === 'en_attente' ? 'border-red-300 bg-red-50/30' :
        tube.statut === 'termine' ? 'border-green-200' :
        'border-gray-200'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statutInfo.bg}`}>
              <Cylinder className={`w-5 h-5 ${statutInfo.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">Tube N°{tube.numero}</h3>
                {tube.type_tube === 'cross_welding' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">CW</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutInfo.bg} ${statutInfo.text}`}>
                  {statutInfo.label}
                </span>
                {hasNC && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">NC</span>}
                {hasSaute && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium flex items-center gap-1"><WifiOff className="w-3 h-3" />Offline</span>}
                {tube.statut === 'termine' && tube.decision && tube.decision !== 'en_attente' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DECISION_INFO[tube.decision]?.bg} ${DECISION_INFO[tube.decision]?.text}`}>
                    {DECISION_INFO[tube.decision]?.badge} {DECISION_INFO[tube.decision]?.label}
                  </span>
                )}
                {tube.statut === 'termine' && (!tube.decision || tube.decision === 'en_attente') && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 border border-amber-200">
                    ⏳ Décision
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Coulée {tube.coulee_numero}{tube.coulee_numero_2 ? ` → ${tube.coulee_numero_2}` : ''} · ⌀{tube.diametre_mm}mm {tube.diametre_pouce ? `(${tube.diametre_pouce})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {etapeCourante && tube.statut !== 'termine' && tube.statut !== 'rebut' && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                {etapeCourante.nom} · {tube.etape_courante}/12
              </span>
            )}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res = await api.get(`/tubes/${tube.id}/pdf`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tube_${tube.numero}.pdf`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  console.error('Erreur PDF:', err);
                }
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Télécharger rapport PDF"
            >
              <FileText className="w-4 h-4" />
            </button>
            {(tube.decision === 'certifie_api' || tube.decision === 'certifie_hydraulique') && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await api.get(`/tubes/${tube.id}/certificat`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `certificat_tube_${tube.numero}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Erreur certificat:', err);
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  tube.decision === 'certifie_api'
                    ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                    : 'text-blue-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title={`Télécharger certificat ${tube.decision === 'certifie_api' ? 'API 5L' : 'Hydraulique'}`}
              >
                <Award className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Timeline horizontale - 12 étapes */}
        <div className="flex items-center gap-0.5">
          {ETAPES.map((etapeDef, idx) => {
            const tubeEtape = (tube.etapes || []).find(e => e.etape_numero === etapeDef.numero);
            const statut = tubeEtape?.statut || 'en_attente';
            const colors = ETAPE_STATUT_COLORS[statut];

            return (
              <div key={etapeDef.numero} className="flex-1 group relative">
                <div className={`h-2 rounded-full ${colors.bg} transition-all ${
                  statut === 'en_cours' ? 'animate-pulse ring-2 ring-blue-300' : ''
                } ${statut === 'non_conforme' ? 'animate-pulse ring-2 ring-red-300' : ''}`} />
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                  <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {etapeDef.numero}. {etapeDef.nom}
                    {etapeDef.offline && ' [OFFLINE]'}
                    {statut !== 'en_attente' && ` — ${statut.replace('_', ' ')}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Formage</span>
          <span className="text-xs text-gray-400">{etapesValidees}/12 validées</span>
          <span className="text-xs text-gray-400">CV Chanfrein</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Constants paramètres pour NewTubeModal
// ============================================
const GAZ_OPTIONS = [
  { value: 'CO2', label: 'CO₂' },
  { value: 'Argon_CO2', label: 'Argon / CO₂' },
  { value: 'Argon_O2', label: 'Argon / O₂' },
  { value: 'Argon_pur', label: 'Argon pur' },
  { value: 'Autre', label: 'Autre' }
];
const FIL_OPTIONS = ['1.0mm', '1.2mm', '1.6mm', '2.0mm', '2.4mm', '3.2mm', '4.0mm'];
const FLUX_OPTIONS = [
  { value: 'SAW', label: 'SAW' },
  { value: 'FCAW', label: 'FCAW' },
  { value: 'GMAW', label: 'GMAW' },
  { value: 'Autre', label: 'Autre' }
];
const DEFAULT_HEADS = [
  { type: 'ID', numero: 1, actif: true, amperage: 0, voltage: 0 },
  { type: 'ID', numero: 2, actif: true, amperage: 0, voltage: 0 },
  { type: 'ID', numero: 3, actif: false, amperage: 0, voltage: 0 },
  { type: 'OD', numero: 1, actif: true, amperage: 0, voltage: 0 },
  { type: 'OD', numero: 2, actif: true, amperage: 0, voltage: 0 },
];

// Mini accordion section
function TubeParamSection({ title, color, open, onToggle, children }) {
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

// ============================================
// NewTubeModal - Créer un nouveau tube
// ============================================
function NewTubeModal({ onClose, onCreated }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [prochainNumero, setProchainNumero] = useState('');
  const [couleeActive, setCouleeActive] = useState(null);
  const [nextCoulee, setNextCoulee] = useState(null); // 2e coulée pour CW
  const [preset, setPreset] = useState(null); // preset de la coulée
  const [editingParams, setEditingParams] = useState(false);
  const [openSections, setOpenSections] = useState({ formage: true, tack: false, soudure: false });
  const [editForm, setEditForm] = useState({});
  const [editHeads, setEditHeads] = useState(DEFAULT_HEADS);
  const [form, setForm] = useState({
    type_tube: 'normal',
    numero: '',
    diametre_pouce: '',
    diametre_mm: '',
    longueur: '',
    epaisseur: '',
    notes: ''
  });

  // Charger les coulées actives, le prochain numéro et le preset
  useEffect(() => {
    api.get('/coulees')
      .then(r => {
        // Trouver toutes les coulées en production (triées par date)
        const enProduction = r.data
          .filter(c => c.statut === 'en_production')
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        // Fallback sur pret_production si aucune en_production
        const active = enProduction[0] || r.data.find(c => c.statut === 'pret_production');
        const next = enProduction.length >= 2 ? enProduction[1] : null;
        if (active) {
          setCouleeActive(active);
          setNextCoulee(next);
          // Charger le prochain numéro (global, pas par coulée)
          api.get('/tubes/prochain-numero')
            .then(r2 => {
              setProchainNumero(r2.data.numero);
              setForm(f => ({ ...f, numero: String(r2.data.numero) }));
            }).catch(() => {});
          // Charger le preset de la coulée
          if (active.parametre_id) {
            api.get(`/parametres/${active.parametre_id}`)
              .then(r3 => {
                setPreset(r3.data);
                // Pré-remplir le formulaire d'édition
                const p = r3.data;
                setEditForm({
                  strip_vitesse_m: p.strip_vitesse_m || 0,
                  strip_vitesse_cm: p.strip_vitesse_cm || 0,
                  milling_edge_gauche: p.milling_edge_gauche || 0,
                  milling_edge_droit: p.milling_edge_droit || 0,
                  pression_rouleaux: p.pression_rouleaux || '',
                  pression_rouleaux_unite: p.pression_rouleaux_unite || 'tonnes',
                  tack_amperage: p.tack_amperage || 0,
                  tack_voltage: p.tack_voltage || 0,
                  tack_vitesse_m: p.tack_vitesse_m || 0,
                  tack_vitesse_cm: p.tack_vitesse_cm || 0,
                  tack_frequence: p.tack_frequence || '',
                  tack_type_gaz: p.tack_type_gaz || 'CO2',
                  tack_debit_gaz: p.tack_debit_gaz || '',
                  soudure_vitesse_m: p.soudure_vitesse_m || 0,
                  soudure_vitesse_cm: p.soudure_vitesse_cm || 0,
                  soudure_type_fil: p.soudure_type_fil || '1.6mm',
                  soudure_type_flux: p.soudure_type_flux || 'SAW',
                  notes: '',
                });
                setEditHeads(p.heads && p.heads.length > 0 ? p.heads.map(h => ({...h})) : DEFAULT_HEADS);
              }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto-remplir le diamètre mm quand on choisit en pouces
  const handleDiametreChange = (value) => {
    const found = DIAMETRES.find(d => d.pouce === value);
    setForm(f => ({
      ...f,
      diametre_pouce: value,
      diametre_mm: found ? String(found.mm) : f.diametre_mm
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.numero || !form.diametre_mm) {
      showToast('Remplissez les champs obligatoires', 'error');
      return;
    }
    if (!couleeActive) {
      showToast('Aucune coulée active trouvée', 'error');
      return;
    }
    if (form.type_tube === 'cross_welding' && !nextCoulee) {
      showToast('Cross Welding impossible : aucune prochaine coulée en production', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        coulee_id: couleeActive.id,
        type_tube: form.type_tube,
        numero: form.numero,
        diametre_mm: parseFloat(form.diametre_mm),
        diametre_pouce: form.diametre_pouce || null,
        longueur: form.longueur ? parseFloat(form.longueur) : null,
        epaisseur: form.epaisseur ? parseFloat(form.epaisseur) : null,
        notes: form.notes || null,
      };

      if (editingParams) {
        // Envoyer les paramètres modifiés → backend créera un nouveau preset
        payload.parametres = { ...editForm, heads: editHeads };
      } else if (preset) {
        // Utiliser le preset existant de la coulée
        payload.parametre_id = preset.id;
      }

      const response = await api.post('/tubes', payload);
      onCreated(response.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur création', 'error');
    } finally {
      setLoading(false);
    }
  };

  const activeHeads = editHeads.filter(h => h.actif);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-bold">Nouveau Tube</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Coulée active (info) */}
          {couleeActive ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <span className="font-medium">Coulée active :</span>
              {couleeActive.date_production && (
                <span className="text-blue-500">
                  {new Date(couleeActive.date_production).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}{' '}
                  {new Date(couleeActive.date_production).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                </span>
              )}
              N°{couleeActive.numero} {couleeActive.bobine_numero ? `(Bobine ${couleeActive.bobine_numero})` : ''}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Aucune coulée active trouvée
            </div>
          )}

          {/* Type de Tube */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de Tube *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type_tube: 'normal' }))}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.type_tube === 'normal'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-lg font-bold">Normal</span>
                <span className="text-xs opacity-70">Tube standard</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, type_tube: 'cross_welding' }))}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all ${
                  form.type_tube === 'cross_welding'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-lg font-bold">Cross Welding</span>
                <span className="text-xs opacity-70">Soudure croisée</span>
              </button>
            </div>
          </div>

          {/* CW Info / Warning */}
          {form.type_tube === 'cross_welding' && (
            nextCoulee ? (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">Cross Welding : Coulée N°{couleeActive?.numero} → N°{nextCoulee.numero}</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Ce tube sera rattaché aux deux coulées. La coulée N°{couleeActive?.numero} sera automatiquement clôturée.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">Cross Welding impossible</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Aucune prochaine coulée engagée (en production). Lancez la production d'une 2ᵉ coulée avant de créer un tube CW.
                  </p>
                </div>
              </div>
            )
          )}

          {/* Paramètres de Production */}
          <div className="border border-violet-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-violet-50">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-800">Paramètres de Production</span>
                {preset && !editingParams && (
                  <span className="font-mono text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-300">
                    {preset.numero}
                  </span>
                )}
              </div>
              {preset && (
                <button
                  type="button"
                  onClick={() => setEditingParams(!editingParams)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all ${
                    editingParams
                      ? 'bg-amber-100 text-amber-700 border-amber-300'
                      : 'bg-violet-100 text-violet-700 border-violet-300 hover:bg-violet-200'
                  }`}
                >
                  <Edit3 className="w-3 h-3" /> {editingParams ? 'Annuler modif.' : 'Modifier'}
                </button>
              )}
            </div>
            <div className="p-3">
              {!preset ? (
                <div className="text-center py-3 text-gray-400">
                  <Settings className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  <p className="text-xs">Aucun preset sur cette coulée</p>
                </div>
              ) : !editingParams ? (
                /* Affichage résumé compact */
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 block">Strip Speed</span>
                    <span className="font-medium">{preset.strip_vitesse_m}m{String(preset.strip_vitesse_cm || 0).padStart(2,'0')}</span>
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
                    <span className="font-medium">{preset.soudure_vitesse_m}m{String(preset.soudure_vitesse_cm || 0).padStart(2,'0')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Fil / Flux</span>
                    <span className="font-medium">{preset.soudure_type_fil} / {preset.soudure_type_flux}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Têtes</span>
                    <span className="font-medium">{(preset.heads || []).filter(h => h.actif).length} actives</span>
                  </div>
                </div>
              ) : (
                /* Mode édition */
                <div className="space-y-3">
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Un <strong>nouveau preset</strong> sera créé avec ces valeurs modifiées.
                  </div>

                  {/* Formage */}
                  <TubeParamSection title="Formage" color="blue" open={openSections.formage} onToggle={() => setOpenSections(s => ({...s, formage: !s.formage}))}>
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
                  </TubeParamSection>

                  {/* Tackwelding */}
                  <TubeParamSection title="Tackwelding" color="amber" open={openSections.tack} onToggle={() => setOpenSections(s => ({...s, tack: !s.tack}))}>
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
                  </TubeParamSection>

                  {/* Soudure Finale */}
                  <TubeParamSection title="Soudure Finale" color="orange" open={openSections.soudure} onToggle={() => setOpenSections(s => ({...s, soudure: !s.soudure}))}>
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
                  </TubeParamSection>
                </div>
              )}
            </div>
          </div>

          {/* Numéro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de tube *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
              {prochainNumero && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, numero: String(prochainNumero) }))}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200"
                >Auto</button>
              )}
            </div>
            {prochainNumero && <p className="text-xs text-gray-400 mt-1">Suggestion: {prochainNumero}</p>}
          </div>

          {/* Diamètre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diamètre (pouces)</label>
              <select
                value={form.diametre_pouce}
                onChange={e => handleDiametreChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Pouces --</option>
                {DIAMETRES.map(d => (
                  <option key={d.pouce} value={d.pouce}>{d.pouce} ({d.mm} mm)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diamètre (mm) *</label>
              <input
                type="number"
                step="0.1"
                value={form.diametre_mm}
                onChange={e => setForm(f => ({ ...f, diametre_mm: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          {/* Longueur / Épaisseur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longueur (m)</label>
              <input
                type="number"
                step="0.01"
                value={form.longueur}
                onChange={e => setForm(f => ({ ...f, longueur: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Épaisseur (mm)</label>
              <input
                type="number"
                step="0.01"
                value={form.epaisseur}
                onChange={e => setForm(f => ({ ...f, epaisseur: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || (form.type_tube === 'cross_welding' && !nextCoulee)}
              className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> {loading ? 'Création...' : 'Créer le Tube'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// TubeDetailModal - Détail + workflow étapes
// ============================================
function TubeDetailModal({ tube, onClose, onUpdate }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [commentaire, setCommentaire] = useState('');
  const [showNCModal, setShowNCModal] = useState(null); // etape_numero
  const [showResolveModal, setShowResolveModal] = useState(null); // {etape_numero, commentaire}
  const [showPasserModal, setShowPasserModal] = useState(null); // etape_numero
  const [showValiderModal, setShowValiderModal] = useState(null); // etape_numero
  const [etapePhotos, setEtapePhotos] = useState({}); // { etape_numero: [photos] }
  const [photoViewer, setPhotoViewer] = useState(null); // { src, alt }

  // Charger toutes les photos du tube
  useEffect(() => {
    const fetchAllPhotos = async () => {
      try {
        const res = await api.get(`/tubes/${tube.id}/photos`);
        const grouped = {};
        for (const photo of res.data) {
          if (!grouped[photo.etape_numero]) grouped[photo.etape_numero] = [];
          grouped[photo.etape_numero].push(photo);
        }
        setEtapePhotos(grouped);
      } catch (e) { console.error('Erreur chargement photos:', e); }
    };
    fetchAllPhotos();
  }, [tube.id]);

  // Upload photos pour une étape
  const uploadPhotos = async (etapeNumero, files, description) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const f of files) formData.append('photos', f);
    if (description) formData.append('description', description);
    try {
      await api.post(`/tubes/${tube.id}/etape/${etapeNumero}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Refresh photos
      const res = await api.get(`/tubes/${tube.id}/photos`);
      const grouped = {};
      for (const photo of res.data) {
        if (!grouped[photo.etape_numero]) grouped[photo.etape_numero] = [];
        grouped[photo.etape_numero].push(photo);
      }
      setEtapePhotos(grouped);
      return true;
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur upload photos', 'error');
      return false;
    }
  };

  // Supprimer une photo
  const deletePhoto = async (photoId) => {
    try {
      await api.delete(`/tubes/${tube.id}/photos/${photoId}`);
      setEtapePhotos(prev => {
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = v.filter(p => p.id !== photoId);
        }
        return next;
      });
      showToast('Photo supprimée', 'success');
    } catch (err) {
      showToast('Erreur suppression photo', 'error');
    }
  };

  const statutInfo = STATUT_COLORS[tube.statut] || STATUT_COLORS.en_production;
  const etapesValidees = (tube.etapes || []).filter(e => e.statut === 'valide').length;
  const progression = Math.round((etapesValidees / 12) * 100);

  // Valider une étape (with optional photos)
  const validerEtape = async (etapeNumero, photos = null) => {
    setLoading(true);
    try {
      // Upload photos first if provided
      if (photos && photos.length > 0) {
        await uploadPhotos(etapeNumero, photos);
      }
      const response = await api.put(`/tubes/${tube.id}/valider-etape`, {
        etape_numero: etapeNumero,
        commentaire: commentaire || null
      });
      setCommentaire('');
      onUpdate(response.data);
      const etapeNom = ETAPES.find(e => e.numero === etapeNumero)?.nom || etapeNumero;
      showToast(`Étape ${etapeNom} validée ✓`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur validation', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Passer (ignorer) une étape
  const sauterEtape = async (etapeNumero, motif) => {
    setLoading(true);
    try {
      const response = await api.put(`/tubes/${tube.id}/sauter-etape`, { etape_numero: etapeNumero, motif });
      onUpdate(response.data);
      const etapeNom = ETAPES.find(e => e.numero === etapeNumero)?.nom || etapeNumero;
      showToast(`Étape ${etapeNom} passée${motif ? ' — Motif: ' + motif : ''}`, 'info');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Valider étape offline sautée
  const validerOffline = async (etapeNumero) => {
    setLoading(true);
    try {
      const response = await api.put(`/tubes/${tube.id}/valider-offline`, {
        etape_numero: etapeNumero,
        commentaire: commentaire || null
      });
      setCommentaire('');
      onUpdate(response.data);
      showToast(`Étape offline ${etapeNumero} validée`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Marquer non conforme (with optional photos)
  const marquerNC = async (etapeNumero, comment, photos = null) => {
    setLoading(true);
    try {
      // Upload photos first if provided
      if (photos && photos.length > 0) {
        await uploadPhotos(etapeNumero, photos);
      }
      const response = await api.put(`/tubes/${tube.id}/non-conforme`, {
        etape_numero: etapeNumero,
        commentaire: comment
      });
      setShowNCModal(null);
      onUpdate(response.data);
      showToast('Non-conformité enregistrée — tube bloqué', 'error');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Résoudre NC
  const resoudreNC = async (etapeNumero, action, comment) => {
    setLoading(true);
    try {
      const response = await api.put(`/tubes/${tube.id}/resoudre-nc`, {
        etape_numero: etapeNumero,
        action,
        commentaire: comment
      });
      setShowResolveModal(null);
      onUpdate(response.data);
      const messages = { reprise: 'Reprise en cours', rebut: 'Tube mis au rebut', derogation: 'Dérogation accordée' };
      showToast(messages[action] || 'NC résolue', action === 'rebut' ? 'error' : 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          tube.statut === 'en_attente' ? 'bg-red-50' : tube.statut === 'termine' ? 'bg-green-50' : ''
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statutInfo.bg}`}>
              <Cylinder className={`w-5 h-5 ${statutInfo.text}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Tube N°{tube.numero}</h2>
              <p className="text-sm text-gray-500">
                Coulée {tube.coulee_numero}{tube.coulee_numero_2 ? ` → ${tube.coulee_numero_2}` : ''} · ⌀{tube.diametre_mm}mm {tube.diametre_pouce ? `(${tube.diametre_pouce})` : ''}
                {tube.type_tube === 'cross_welding' ? ' · Cross Welding' : ''}
              </p>
            </div>
            {tube.type_tube === 'cross_welding' && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">CW</span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statutInfo.bg} ${statutInfo.text}`}>
              {statutInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                try {
                  const res = await api.get(`/tubes/${tube.id}/pdf`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `tube_${tube.numero}.pdf`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  showToast('Rapport PDF téléchargé', 'success');
                } catch (err) {
                  showToast('Erreur génération PDF', 'error');
                }
              }}
              className="p-2 hover:bg-blue-100 rounded-lg text-blue-600" title="Télécharger rapport PDF"
            >
              <FileText className="w-5 h-5" />
            </button>
            {(tube.decision === 'certifie_api' || tube.decision === 'certifie_hydraulique') && (
              <button
                onClick={async () => {
                  try {
                    const res = await api.get(`/tubes/${tube.id}/certificat`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `certificat_tube_${tube.numero}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    showToast('Certificat téléchargé', 'success');
                  } catch (err) {
                    showToast('Erreur génération certificat', 'error');
                  }
                }}
                className={`p-2 rounded-lg ${
                  tube.decision === 'certifie_api'
                    ? 'hover:bg-emerald-100 text-emerald-600'
                    : 'hover:bg-cyan-100 text-cyan-600'
                }`}
                title={`Télécharger certificat ${tube.decision === 'certifie_api' ? 'API 5L' : 'Hydraulique'}`}
              >
                <Award className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 font-medium">Progression</span>
            <span className="text-gray-500">{etapesValidees}/12 étapes · {progression}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                tube.statut === 'en_attente' ? 'bg-red-500' :
                tube.statut === 'termine' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progression}%` }}
            />
          </div>
          {/* Résumé temps */}
          {(() => {
            const sortedEtapes = (tube.etapes || []).filter(e => e.started_at).sort((a, b) => a.etape_numero - b.etape_numero);
            if (sortedEtapes.length === 0) return null;
            const first = sortedEtapes[0];
            const lastCompleted = [...(tube.etapes || [])].reverse().find(e => e.completed_at);
            const totalElapsed = lastCompleted ? new Date(lastCompleted.completed_at) - new Date(first.started_at) : (new Date() - new Date(first.started_at));
            let totalProd = 0, totalWait = 0;
            for (const e of tube.etapes || []) {
              if (e.started_at && e.completed_at) totalProd += new Date(e.completed_at) - new Date(e.started_at);
              if (e.etape_numero > 1 && e.started_at) {
                const prev = (tube.etapes || []).find(p => p.etape_numero === e.etape_numero - 1);
                if (prev?.completed_at) { const w = new Date(e.started_at) - new Date(prev.completed_at); if (w > 0) totalWait += w; }
              }
            }
            const efficiency = totalElapsed > 0 ? Math.round((totalProd / totalElapsed) * 100) : 0;
            return (
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Clock className="w-3 h-3" /> Total: {formatDuration(totalElapsed)}
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-green-600">Production: {formatDuration(totalProd)}</span>
                {totalWait > 60000 && <>
                  <span className="text-gray-400">·</span>
                  <span className="text-amber-600">Attente: {formatDuration(totalWait)}</span>
                </>}
                <span className="text-gray-400">·</span>
                <span className={`font-medium ${efficiency >= 70 ? 'text-green-600' : efficiency >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  Efficacité: {efficiency}%
                </span>
              </div>
            );
          })()}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Infos tube */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <InfoBadge label="Type" value={tube.type_tube === 'cross_welding' ? 'Cross Welding' : 'Normal'} />
            <InfoBadge label="Bobine" value={tube.bobine_numero || '-'} />
            <InfoBadge label="Épaisseur" value={tube.epaisseur ? `${tube.epaisseur} mm` : (tube.bobine_epaisseur ? `${tube.bobine_epaisseur} mm` : '-')} />
            <InfoBadge label="Longueur" value={tube.longueur ? `${tube.longueur} m` : '-'} />
            <InfoBadge label="Opérateur" value={tube.operateur_prenom ? `${tube.operateur_prenom} ${tube.operateur_nom?.[0] || ''}.` : '-'} />
          </div>

          {/* Paramètres de Production du tube */}
          {tube.parametre_id && (
            <TubeParametresSection tubeId={tube.id} parametreId={tube.parametre_id} parametreNumero={tube.parametre_numero} />
          )}

          {/* Timeline verticale des 12 étapes */}
          <h3 className="font-bold text-gray-900 mb-4">Étapes de Production</h3>
          <div className="space-y-0">
            {ETAPES.map((etapeDef, idx) => {
              const tubeEtape = (tube.etapes || []).find(e => e.etape_numero === etapeDef.numero);
              const statut = tubeEtape?.statut || 'en_attente';
              const EtapeIcon = etapeDef.icon;
              const isLast = idx === ETAPES.length - 1;

              return (
                <div key={etapeDef.numero} className="flex gap-3">
                  {/* Ligne verticale + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                      statut === 'valide' ? 'bg-green-500 border-green-400 text-white' :
                      statut === 'en_cours' ? 'bg-blue-500 border-blue-400 text-white animate-pulse' :
                      statut === 'non_conforme' ? 'bg-red-500 border-red-400 text-white' :
                      statut === 'saute' ? 'bg-amber-400 border-amber-300 text-white' :
                      'bg-gray-100 border-gray-300 text-gray-400'
                    }`}>
                      {statut === 'valide' ? <Check className="w-4 h-4" /> :
                       statut === 'non_conforme' ? <X className="w-4 h-4" /> :
                       statut === 'saute' ? <SkipForward className="w-3.5 h-3.5" /> :
                       <span className="text-xs font-bold">{etapeDef.numero}</span>}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-[20px] ${
                        statut === 'valide' ? 'bg-green-300' :
                        statut === 'non_conforme' ? 'bg-red-300' :
                        'bg-gray-200'
                      }`} />
                    )}
                  </div>

                  {/* Contenu étape */}
                  <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
                    <div className={`rounded-lg border p-3 ${
                      statut === 'en_cours' ? 'border-blue-300 bg-blue-50' :
                      statut === 'non_conforme' ? 'border-red-300 bg-red-50' :
                      statut === 'saute' ? 'border-amber-300 bg-amber-50' :
                      statut === 'valide' ? 'border-green-200 bg-green-50/50' :
                      'border-gray-200 bg-gray-50/50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <EtapeIcon className={`w-4 h-4 ${
                            statut === 'valide' ? 'text-green-600' :
                            statut === 'en_cours' ? 'text-blue-600' :
                            statut === 'non_conforme' ? 'text-red-600' :
                            statut === 'saute' ? 'text-amber-600' :
                            'text-gray-400'
                          }`} />
                          <span className={`font-medium text-sm ${
                            statut === 'en_attente' ? 'text-gray-400' : 'text-gray-900'
                          }`}>
                            {etapeDef.nom}
                          </span>
                          {etapeDef.offline && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium flex items-center gap-1">
                              <WifiOff className="w-3 h-3" /> OFFLINE
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {statut === 'en_cours' && (
                            <>
                              <button
                                onClick={() => setShowValiderModal(etapeDef.numero)}
                                disabled={loading}
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Valider
                              </button>
                              <button
                                onClick={() => setShowPasserModal(etapeDef.numero)}
                                disabled={loading}
                                className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 disabled:opacity-50"
                              >
                                <SkipForward className="w-3.5 h-3.5" /> Passer
                              </button>
                              <button
                                onClick={() => setShowNCModal(etapeDef.numero)}
                                disabled={loading}
                                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                <AlertOctagon className="w-3.5 h-3.5" /> NC
                              </button>
                            </>
                          )}
                          {statut === 'saute' && (
                            <button
                              onClick={() => validerOffline(etapeDef.numero)}
                              disabled={loading}
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Valider maintenant
                            </button>
                          )}
                          {statut === 'non_conforme' && tube.statut === 'en_attente' && (
                            <button
                              onClick={() => setShowResolveModal({ etape_numero: etapeDef.numero })}
                              className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Résoudre
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Info validation */}
                      {(statut === 'valide' || statut === 'non_conforme' || statut === 'saute') && tubeEtape && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div className="flex items-center flex-wrap gap-x-2">
                            {tubeEtape.operateur_prenom && (
                              <span>Par {tubeEtape.operateur_prenom} {tubeEtape.operateur_nom?.[0]}. </span>
                            )}
                            {tubeEtape.completed_at && (
                              <span>le {new Date(tubeEtape.completed_at).toLocaleString('fr-FR')}</span>
                            )}
                            {statut === 'saute' && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">PASSÉE</span>
                            )}
                            {(() => {
                              const dur = getEtapeDuration(tubeEtape);
                              if (!dur) return null;
                              return (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                                  <Clock className="w-3 h-3" /> {formatDuration(dur)}
                                </span>
                              );
                            })()}
                            {(() => {
                              const prevEtape = (tube.etapes || []).find(e => e.etape_numero === etapeDef.numero - 1);
                              const delay = getInterDelay(prevEtape, tubeEtape);
                              if (!delay || delay < 60000) return null; // Skip if < 1min
                              const isLong = delay > 3600000; // > 1h
                              return (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium ${
                                  isLong ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  ⏱ attente {formatDuration(delay)}
                                </span>
                              );
                            })()}
                          </div>
                          {tubeEtape.commentaire && (
                            <p className="mt-1 italic text-gray-600 flex items-start gap-1">
                              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {tubeEtape.commentaire}
                            </p>
                          )}
                          {/* Photos de l'étape */}
                          {(etapePhotos[etapeDef.numero] || []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(etapePhotos[etapeDef.numero] || []).map(photo => (
                                <div key={photo.id} className="relative group">
                                  <img
                                    src={`${API_URL}${photo.path}`}
                                    alt={photo.original_name}
                                    className="w-12 h-12 object-cover rounded-md border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => setPhotoViewer({ src: `${API_URL}${photo.path}`, alt: photo.original_name })}
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id); }}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                                <Camera className="w-3 h-3" /> {(etapePhotos[etapeDef.numero] || []).length}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Champ commentaire pour étape en cours + inline upload */}
                      {statut === 'en_cours' && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={commentaire}
                            onChange={e => setCommentaire(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                            placeholder="Commentaire (optionnel)..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tube terminé — Panneau Décision Finale */}
          {tube.statut === 'termine' && (
            <DecisionPanel tube={tube} onUpdate={onUpdate} />
          )}
        </div>
      </div>

      {/* Modal Valider Étape (avec photos) */}
      {showValiderModal && (
        <ValiderModal
          etapeNumero={showValiderModal}
          onSubmit={(comment, photos) => {
            validerEtape(showValiderModal, photos);
            setShowValiderModal(null);
          }}
          onClose={() => setShowValiderModal(null)}
          loading={loading}
        />
      )}

      {/* Modal Non-Conformité (avec photos) */}
      {showNCModal && (
        <NCModal
          etapeNumero={showNCModal}
          onSubmit={(comment, photos) => marquerNC(showNCModal, comment, photos)}
          onClose={() => setShowNCModal(null)}
          loading={loading}
        />
      )}

      {/* Modal Passer (ignorer) étape (avec photos) */}
      {showPasserModal && (
        <PasserModal
          etapeNumero={showPasserModal}
          onSubmit={(motif, photos) => {
            uploadPhotos(showPasserModal, photos);
            sauterEtape(showPasserModal, motif);
            setShowPasserModal(null);
          }}
          onClose={() => setShowPasserModal(null)}
          loading={loading}
        />
      )}

      {/* Modal Résolution NC */}
      {showResolveModal && (
        <ResolveNCModal
          etapeNumero={showResolveModal.etape_numero}
          onSubmit={(action, comment) => resoudreNC(showResolveModal.etape_numero, action, comment)}
          onClose={() => setShowResolveModal(null)}
          loading={loading}
        />
      )}

      {/* Photo Viewer */}
      {photoViewer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={() => setPhotoViewer(null)}>
          <button
            onClick={() => setPhotoViewer(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={photoViewer.src}
            alt={photoViewer.alt}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// DecisionPanel - Décision finale après production
// ============================================
function DecisionPanel({ tube, onUpdate }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [panelOpened, setPanelOpened] = useState(false);

  const decisionInfo = DECISION_INFO[tube.decision] || DECISION_INFO.en_attente;
  const isDecided = tube.decision && tube.decision !== 'en_attente';

  // Marquer début de décision quand on ouvre le panneau
  const openDecisionPanel = async () => {
    setPanelOpened(true);
    try {
      await api.put(`/tubes/${tube.id}/debut-decision`);
    } catch (err) {
      console.error('Erreur début décision:', err);
    }
  };

  // Valider la décision
  const validerDecision = async () => {
    if (!selectedDecision) return;
    setLoading(true);
    try {
      const response = await api.put(`/tubes/${tube.id}/decision`, {
        decision: selectedDecision,
        commentaire: commentaire || null
      });
      onUpdate(response.data);
      const label = DECISION_INFO[selectedDecision]?.label || selectedDecision;
      showToast(`Décision enregistrée : ${label}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur décision', 'error');
    } finally {
      setLoading(false);
    }
  };

  const decisions = [
    { 
      value: 'certifie_api', label: 'Certifié API', 
      desc: 'Conforme aux normes API 5L',
      icon: Trophy, color: 'emerald',
      btnClass: 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100',
      selectedClass: 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-300',
      iconColor: 'text-emerald-600'
    },
    { 
      value: 'certifie_hydraulique', label: 'Certifié Hydraulique', 
      desc: 'Usage hydraulique uniquement',
      icon: Wrench, color: 'blue',
      btnClass: 'border-blue-500 bg-blue-50 hover:bg-blue-100',
      selectedClass: 'border-blue-500 bg-blue-100 ring-2 ring-blue-300',
      iconColor: 'text-blue-600'
    },
    { 
      value: 'declasse', label: 'Déclassé', 
      desc: 'Ne répond pas aux critères de certification',
      icon: AlertTriangle, color: 'orange',
      btnClass: 'border-orange-500 bg-orange-50 hover:bg-orange-100',
      selectedClass: 'border-orange-500 bg-orange-100 ring-2 ring-orange-300',
      iconColor: 'text-orange-600'
    },
  ];

  // Décision déjà prise — affichage résumé
  if (isDecided) {
    return (
      <div className={`mt-4 ${decisionInfo.bg} border ${decisionInfo.border} rounded-lg p-4`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{decisionInfo.badge}</span>
          <div>
            <h3 className={`font-bold ${decisionInfo.text}`}>Décision : {decisionInfo.label}</h3>
            <p className="text-sm text-gray-600">
              Par {tube.decision_par || '—'} le {tube.decision_date ? new Date(tube.decision_date).toLocaleString('fr-FR') : '—'}
            </p>
          </div>
        </div>
        {tube.decision_commentaire && (
          <p className="text-sm text-gray-600 italic mt-1 flex items-start gap-1">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {tube.decision_commentaire}
          </p>
        )}
        {/* Timestamps traçabilité */}
        <div className="mt-3 pt-3 border-t border-gray-200/60 grid grid-cols-3 gap-2 text-xs text-gray-500">
          <div>
            <span className="block font-medium text-gray-600">Fin production</span>
            {tube.date_fin_production ? new Date(tube.date_fin_production).toLocaleString('fr-FR') : '—'}
          </div>
          <div>
            <span className="block font-medium text-gray-600">Début décision</span>
            {tube.date_debut_decision ? new Date(tube.date_debut_decision).toLocaleString('fr-FR') : '—'}
          </div>
          <div>
            <span className="block font-medium text-gray-600">Fin décision</span>
            {tube.date_fin_decision ? new Date(tube.date_fin_decision).toLocaleString('fr-FR') : '—'}
          </div>
        </div>
      </div>
    );
  }

  // Pas encore décidé — panneau interactif
  return (
    <div className="mt-4 border border-green-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          <h3 className="font-bold text-green-700">Production terminée</h3>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          ⏳ Décision en attente
        </span>
      </div>

      {/* Timestamps */}
      {tube.date_fin_production && (
        <div className="px-4 py-2 bg-green-50/50 border-b border-green-100 text-xs text-gray-500">
          Production terminée le {new Date(tube.date_fin_production).toLocaleString('fr-FR')}
        </div>
      )}

      {!panelOpened ? (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-600 mb-3">Toutes les 12 étapes ont été validées. Prendre la décision finale ?</p>
          <button
            onClick={openDecisionPanel}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <Award className="w-4 h-4" /> Ouvrir le panneau de décision
          </button>
        </div>
      ) : (
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3 font-medium">Choisir la décision finale :</p>
          
          {/* 3 choix */}
          <div className="space-y-2 mb-4">
            {decisions.map(d => {
              const Icon = d.icon;
              const isSelected = selectedDecision === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setSelectedDecision(d.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected ? d.selectedClass : `border-gray-200 hover:${d.btnClass}`
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isSelected ? d.iconColor : 'text-gray-400'}`} />
                  <div>
                    <p className={`font-medium text-sm ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{d.label}</p>
                    <p className="text-xs text-gray-400">{d.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Commentaire */}
          <textarea
            value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={2}
            placeholder="Commentaire de décision (optionnel)..."
          />

          {/* Valider */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setPanelOpened(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Annuler
            </button>
            <button
              onClick={validerDecision}
              disabled={loading || !selectedDecision}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
            >
              <Award className="w-4 h-4" />
              {loading ? 'Enregistrement...' : 'Valider la décision'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// InfoBadge
// ============================================
// Résumé paramètres dans le détail d'un tube
function TubeParametresSection({ tubeId, parametreId, parametreNumero }) {
  const [preset, setPreset] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (parametreId) {
      api.get(`/parametres/${parametreId}`)
        .then(r => setPreset(r.data))
        .catch(() => {});
    }
  }, [parametreId]);

  if (!preset) return null;
  const activeHeads = (preset.heads || []).filter(h => h.actif);

  return (
    <div className="border border-violet-200 rounded-lg overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-violet-800">Paramètres de Production</span>
          <span className="font-mono text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-300">
            {parametreNumero || preset.numero}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-violet-500" /> : <ChevronDown className="w-4 h-4 text-violet-500" />}
      </button>
      {open && (
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-gray-500 block">Strip Speed</span>
              <span className="font-medium">{preset.strip_vitesse_m}m{String(preset.strip_vitesse_cm || 0).padStart(2,'0')}</span>
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
              <span className="font-medium">{preset.soudure_vitesse_m}m{String(preset.soudure_vitesse_cm || 0).padStart(2,'0')}</span>
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
          {activeHeads.length > 0 && (
            <div className="mt-3 pt-3 border-t border-violet-100">
              <div className="flex flex-wrap gap-2">
                {activeHeads.map((h, i) => (
                  <span key={i} className="text-xs bg-violet-50 text-violet-700 px-2 py-1 rounded border border-violet-200">
                    {h.type} #{h.numero}: {h.amperage}A / {h.voltage}V
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBadge({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-900 text-sm">{value}</p>
    </div>
  );
}

// ============================================
// PhotoUploadSection - Composant réutilisable d'upload photos
// ============================================
function PhotoUploadSection({ files, setFiles }) {
  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const removeFile = (idx) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="mb-4">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
        <Camera className="w-4 h-4" /> Photos (optionnel)
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {files.map((file, idx) => (
          <div key={idx} className="relative group">
            <img
              src={URL.createObjectURL(file)}
              alt={file.name}
              className="w-16 h-16 object-cover rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={() => removeFile(idx)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < 5 && (
          <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Camera className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] text-gray-400 mt-0.5">Ajouter</span>
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>
      <p className="text-[10px] text-gray-400">{files.length}/5 photos · Max 5MB chacune</p>
    </div>
  );
}

// ============================================
// ValiderModal - Valider une étape avec photos
// ============================================
function ValiderModal({ etapeNumero, onSubmit, onClose, loading }) {
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const etape = ETAPES.find(e => e.numero === etapeNumero);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4 text-green-600">
          <Check className="w-6 h-6" />
          <h3 className="font-bold text-lg">Valider l'étape</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Étape {etapeNumero}: <strong>{etape?.nom}</strong>
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-green-500"
          rows={2}
          placeholder="Commentaire (optionnel)..."
          autoFocus
        />
        <PhotoUploadSection files={photos} setFiles={setPhotos} />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onSubmit(comment, photos)}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {photos.length > 0 && <Camera className="w-4 h-4" />}
            {loading ? 'Validation...' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PasserModal - Motif du passage d'étape avec photos
// ============================================
function PasserModal({ etapeNumero, onSubmit, onClose, loading }) {
  const [motif, setMotif] = useState('');
  const [photos, setPhotos] = useState([]);
  const etape = ETAPES.find(e => e.numero === etapeNumero);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4 text-amber-600">
          <SkipForward className="w-6 h-6" />
          <h3 className="font-bold text-lg">Passer cette étape</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Étape {etapeNumero}: <strong>{etape?.nom}</strong>
          <br />Cette étape sera marquée comme <span className="text-amber-600 font-medium">ignorée</span> et pourra être validée ultérieurement.
        </p>
        <textarea
          value={motif}
          onChange={e => setMotif(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          rows={3}
          placeholder="Motif du passage (optionnel)..."
          autoFocus
        />
        <PhotoUploadSection files={photos} setFiles={setPhotos} />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onSubmit(motif, photos)}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            Confirmer le passage
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// NCModal - Détailler la non-conformité avec photos
// ============================================
function NCModal({ etapeNumero, onSubmit, onClose, loading }) {
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const etape = ETAPES.find(e => e.numero === etapeNumero);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4 text-red-600">
          <AlertOctagon className="w-6 h-6" />
          <h3 className="font-bold text-lg">Non-Conformité</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Étape {etapeNumero}: <strong>{etape?.nom}</strong>
          <br />Le tube sera <span className="text-red-600 font-medium">bloqué</span> jusqu'à décision (reprise / rebut / dérogation).
        </p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500"
          rows={3}
          placeholder="Décrivez la non-conformité..."
          required
        />
        <PhotoUploadSection files={photos} setFiles={setPhotos} />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onSubmit(comment, photos)}
            disabled={loading || !comment.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {photos.length > 0 && <Camera className="w-4 h-4" />}
            Confirmer NC
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ResolveNCModal - Résoudre une non-conformité
// ============================================
function ResolveNCModal({ etapeNumero, onSubmit, onClose, loading }) {
  const [action, setAction] = useState('');
  const [comment, setComment] = useState('');
  const etape = ETAPES.find(e => e.numero === etapeNumero);

  const actions = [
    { 
      value: 'reprise', label: 'Reprise', 
      desc: 'Corriger et re-valider cette étape',
      icon: RotateCcw, color: 'blue'
    },
    { 
      value: 'derogation', label: 'Dérogation', 
      desc: 'Accepter malgré la NC et continuer',
      icon: ShieldCheck, color: 'amber'
    },
    { 
      value: 'rebut', label: 'Rebut', 
      desc: 'Le tube est définitivement rejeté',
      icon: Ban, color: 'red'
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4 text-orange-600">
          <RotateCcw className="w-6 h-6" />
          <h3 className="font-bold text-lg">Résoudre la NC</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Étape {etapeNumero}: <strong>{etape?.nom}</strong>
        </p>

        {/* Choix d'action */}
        <div className="space-y-2 mb-4">
          {actions.map(a => {
            const Icon = a.icon;
            const colorMap = {
              blue: { border: 'border-blue-500 bg-blue-50', icon: 'text-blue-600' },
              amber: { border: 'border-amber-500 bg-amber-50', icon: 'text-amber-600' },
              red: { border: 'border-red-500 bg-red-50', icon: 'text-red-600' },
            };
            const colors = colorMap[a.color];
            const isSelected = action === a.value;

            return (
              <button
                key={a.value}
                onClick={() => setAction(a.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                  isSelected ? colors.border : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isSelected ? colors.icon : 'text-gray-400'}`} />
                <div>
                  <p className={`font-medium text-sm ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{a.label}</p>
                  <p className="text-xs text-gray-400">{a.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-orange-500"
          rows={2}
          placeholder="Justification..."
        />

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
          <button
            onClick={() => onSubmit(action, comment)}
            disabled={loading || !action}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
