import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { checklistPeriodiqueApi, couleesApi } from '../services/api';
import {
  ClipboardCheck,
  Clock,
  Calendar,
  CalendarDays,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  ChevronRight,
  RefreshCw,
  Flame,
  Timer,
  History,
  FileCheck,
  User,
  Search,
  Wrench,
  ChevronDown
} from 'lucide-react';

export default function Checklists() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [periodiqueTypes, setPeriodiqueTypes] = useState([]);
  const [couleesEnCours, setCouleesEnCours] = useState([]);
  const [operateurs, setOperateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);

  // Operator selection modal
  const [operateurModal, setOperateurModal] = useState(null); // typeId
  const [selectedOperateur, setSelectedOperateur] = useState(null);
  const [operateurSearch, setOperateurSearch] = useState('');

  // History
  const [historyTypeId, setHistoryTypeId] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesRes, couleesRes, opsRes] = await Promise.all([
        checklistPeriodiqueApi.getTypes(),
        couleesApi.getAll(),
        checklistPeriodiqueApi.getOperateurs()
      ]);

      setPeriodiqueTypes(typesRes.data);
      setOperateurs(opsRes.data);

      // Coulées avec checklist en attente
      const coulees = couleesRes.data.filter(c =>
        c.statut === 'en_cours' && !c.checklist_validee
      );
      setCouleesEnCours(coulees);
    } catch (err) {
      console.error('Erreur chargement:', err);
      addToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOperateurModal = (typeId) => {
    setOperateurModal(typeId);
    setSelectedOperateur(null);
    setOperateurSearch('');
  };

  const handleStartSession = async () => {
    if (!operateurModal) return;
    setStarting(operateurModal);
    try {
      const res = await checklistPeriodiqueApi.startSession(operateurModal, selectedOperateur);
      setOperateurModal(null);
      navigate(`/checklist-periodique/${res.data.session_id}`);
    } catch (err) {
      console.error('Erreur démarrage session:', err);
      addToast('Erreur lors du démarrage de la checklist', 'error');
    } finally {
      setStarting(null);
    }
  };

  const loadHistory = async (typeId) => {
    if (historyTypeId === typeId) {
      setHistoryTypeId(null);
      return;
    }
    setHistoryTypeId(typeId);
    setHistoryLoading(true);
    try {
      const res = await checklistPeriodiqueApi.getHistorique(typeId);
      setHistoryData(res.data);
    } catch (err) {
      addToast('Erreur chargement historique', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getTypeIcon = (code) => {
    switch (code) {
      case 'DEBUT_QUART': return Clock;
      case 'HEBDOMADAIRE': return Calendar;
      case 'MENSUELLE': return CalendarDays;
      default: return ClipboardCheck;
    }
  };

  const getTypeColor = (code) => {
    switch (code) {
      case 'DEBUT_QUART': return { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' };
      case 'HEBDOMADAIRE': return { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' };
      case 'MENSUELLE': return { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', badge: 'bg-gray-100 text-gray-700' };
    }
  };

  const formatExpiration = (heures) => {
    if (heures <= 0) return 'Expirée';
    if (heures < 1) return `${Math.round(heures * 60)} min`;
    if (heures < 24) return `${heures}h`;
    return `${Math.round(heures / 24)}j`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
      ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  };

  const filteredOps = operateurs.filter(op => {
    if (!operateurSearch) return true;
    const search = operateurSearch.toLowerCase();
    return (op.prenom + ' ' + op.nom).toLowerCase().includes(search) ||
      op.matricule?.toLowerCase().includes(search);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Chargement des checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="w-7 h-7 text-primary-600" />
            Checklists
          </h1>
          <p className="text-gray-500 mt-1">Checklists machine et vérifications périodiques</p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* ============================== */}
      {/* Section: Checklists Périodiques */}
      {/* ============================== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-500" />
          Vérifications Périodiques
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          La checklist de début de quart doit être validée avant de pouvoir lancer une production.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {periodiqueTypes.map(type => {
            const Icon = getTypeIcon(type.code);
            const colors = getTypeColor(type.code);
            const isValid = type.est_valide;

            return (
              <div
                key={type.id}
                className={`rounded-2xl border-2 ${isValid ? 'border-success-200 bg-white' : `${colors.border} ${colors.bg}`} p-5 transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isValid ? 'bg-success-100' : colors.bg}`}>
                      <Icon className={`w-6 h-6 ${isValid ? 'text-success-600' : colors.icon}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{type.nom}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {type.frequence}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  {isValid ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success-700 bg-success-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Valide
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-danger-700 bg-danger-100 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" />
                      {type.derniere_session ? 'Expirée' : 'Non fait'}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Points de contrôle</span>
                    <span className="font-medium text-gray-700">{type.total_items}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Points critiques</span>
                    <span className="font-medium text-danger-600">{type.total_critiques}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Validité</span>
                    <span className="font-medium text-gray-700">{type.duree_validite_heures}h</span>
                  </div>
                  {isValid && type.expire_dans > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        Expire dans
                      </span>
                      <span className={`font-medium ${type.expire_dans < 2 ? 'text-warning-600' : 'text-success-600'}`}>
                        {formatExpiration(type.expire_dans)}
                      </span>
                    </div>
                  )}
                  {isValid && type.derniere_session && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        Validée par
                      </span>
                      <span className="font-medium text-gray-700 truncate max-w-[120px]">
                        {type.derniere_session.valideur?.trim() || '—'}
                      </span>
                    </div>
                  )}
                  {isValid && type.derniere_session?.date_validation && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Le
                      </span>
                      <span className="font-medium text-gray-500 text-xs">
                        {formatDate(type.derniere_session.date_validation)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenOperateurModal(type.id)}
                    disabled={starting === type.id}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                      isValid
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                    }`}
                  >
                    {starting === type.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isValid ? 'Refaire' : 'Démarrer'}
                  </button>
                  <button
                    onClick={() => loadHistory(type.id)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                    title="Historique"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================== */}
      {/* Section: Historique             */}
      {/* ============================== */}
      {historyTypeId && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-500" />
              Historique — {periodiqueTypes.find(t => t.id === historyTypeId)?.nom}
            </h2>
            <button
              onClick={() => setHistoryTypeId(null)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Fermer
            </button>
          </div>

          {historyLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-6 h-6 text-primary-500 animate-spin mx-auto" />
            </div>
          ) : historyData.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Aucun historique pour cette checklist</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Session</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Opérateur</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Durée</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Résultat</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {historyData.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-700">#{s.id}</td>
                        <td className="px-4 py-3 text-gray-600">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-700">{s.valideur?.trim() || '—'}</span>
                            {s.operateur_matricule && (
                              <span className="text-xs text-gray-400">({s.operateur_matricule})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatDuration(s.duree_minutes)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success-100 text-success-700">
                              <CheckCircle2 className="w-3 h-3" /> {s.conformes || 0}
                            </span>
                            {(s.non_conformes > 0) && (
                              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-danger-100 text-danger-700">
                                <XCircle className="w-3 h-3" /> {s.non_conformes}
                              </span>
                            )}
                            {(s.corriges > 0) && (
                              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-warning-100 text-warning-700">
                                <Wrench className="w-3 h-3" /> {s.corriges}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {s.statut === 'validee' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success-700">
                              <CheckCircle2 className="w-3 h-3" /> Validée
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              En cours
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
                {historyData.length} session(s) — 
                {historyData.filter(s => s.statut === 'validee').length} validée(s)
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================== */}
      {/* Section: Checklists Machine    */}
      {/* ============================== */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-amber-500" />
          Checklists Machine (par coulée)
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Chaque coulée en production nécessite une inspection machine complète avant de passer en production.
        </p>

        {couleesEnCours.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune coulée en attente de checklist</p>
            <p className="text-sm text-gray-400 mt-1">
              Les coulées installées apparaîtront ici pour inspection
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {couleesEnCours.map(coulee => (
              <button
                key={coulee.id}
                onClick={() => navigate(`/checklist-machine/${coulee.id}`)}
                className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:border-amber-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold text-gray-900">
                      Coulée #{coulee.numero_coulee}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-500 transition-colors" />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bobine</span>
                    <span className="font-medium text-gray-700">{coulee.bobine_numero || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Grade</span>
                    <span className="font-medium text-gray-700">{coulee.steel_grade || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Statut</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <AlertTriangle className="w-3 h-3" />
                      Checklist requise
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ============================== */}
      {/* Modal: Sélection opérateur     */}
      {/* ============================== */}
      {operateurModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              Sélectionner l'opérateur
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Qui effectue cette vérification ?
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={operateurSearch}
                onChange={e => setOperateurSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                placeholder="Rechercher par nom ou matricule..."
                autoFocus
              />
            </div>

            {/* Operators list */}
            <div className="max-h-64 overflow-y-auto space-y-1 mb-4">
              {filteredOps.map(op => (
                <button
                  key={op.id}
                  onClick={() => setSelectedOperateur(op.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selectedOperateur === op.id
                      ? 'bg-primary-50 border-2 border-primary-300'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedOperateur === op.id ? 'bg-primary-200 text-primary-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {op.prenom?.[0]}{op.nom?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{op.prenom} {op.nom}</p>
                    <p className="text-xs text-gray-400">{op.matricule} {op.poste ? `— ${op.poste}` : ''}</p>
                  </div>
                  {selectedOperateur === op.id && (
                    <CheckCircle2 className="w-5 h-5 text-primary-600" />
                  )}
                </button>
              ))}
              {filteredOps.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">Aucun opérateur trouvé</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setOperateurModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleStartSession}
                disabled={!selectedOperateur || starting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {starting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
