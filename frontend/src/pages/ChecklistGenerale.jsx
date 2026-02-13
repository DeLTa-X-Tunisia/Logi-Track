import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { checklistPeriodiqueApi } from '../services/api';
import {
  Plus,
  Eye,
  Trash2,
  Clock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  RefreshCw,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileDown,
  Timer,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { generateChecklistPdf } from '../utils/checklistPdf';

const TYPE_MAP = {
  'debut-quart': { code: 'DEBUT_QUART', label: 'Début de Quart', icon: Clock, color: 'blue', freq: '12h' },
  'hebdomadaire': { code: 'HEBDOMADAIRE', label: 'Hebdomadaire', icon: CalendarDays, color: 'purple', freq: '7 jours' },
  'mensuelle': { code: 'MENSUELLE', label: 'Mensuelle', icon: CalendarRange, color: 'amber', freq: '30 jours' },
};

export default function ChecklistGenerale() {
  const { typeSlug } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  const typeInfo = TYPE_MAP[typeSlug];

  const [type, setType] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [operateurs, setOperateurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedOperateur, setSelectedOperateur] = useState('');
  const [creating, setCreating] = useState(false);

  const PER_PAGE = 15;
  const IconComp = typeInfo?.icon || Clock;

  // Charger les données
  const loadData = useCallback(async () => {
    if (!typeInfo) return;
    try {
      setLoading(true);
      const [typesRes, operateursRes] = await Promise.all([
        checklistPeriodiqueApi.getTypes(),
        checklistPeriodiqueApi.getOperateurs(),
      ]);

      const allTypes = typesRes.data;
      const found = allTypes.find(t => t.code === typeInfo.code);
      if (!found) {
        addToast('Type de checklist introuvable', 'error');
        return;
      }
      setType(found);
      setOperateurs(operateursRes.data);

      // Charger historique
      const histRes = await checklistPeriodiqueApi.getHistorique(found.id);
      setSessions(histRes.data);
    } catch (err) {
      console.error('Erreur chargement:', err);
      addToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [typeInfo, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Créer une nouvelle session
  const handleCreate = async () => {
    if (!selectedOperateur) {
      addToast('Veuillez sélectionner un opérateur', 'warning');
      return;
    }
    try {
      setCreating(true);
      const res = await checklistPeriodiqueApi.startSession(type.id, selectedOperateur);
      setShowNewModal(false);
      setSelectedOperateur('');
      navigate(`/checklist-periodique/${res.data.session_id}`);
    } catch (err) {
      addToast('Erreur lors de la création', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Supprimer une session
  const handleDelete = async (sessionId) => {
    const ok = await confirm({
      title: 'Supprimer la checklist',
      message: 'Cette action est irréversible. Toutes les validations associées seront supprimées.',
      confirmLabel: 'Supprimer',
      type: 'danger'
    });
    if (!ok) return;
    try {
      await checklistPeriodiqueApi.deleteSession(sessionId);
      addToast('Checklist supprimée', 'success');
      loadData();
    } catch (err) {
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  // Filtrage et tri
  const filtered = sessions
    .filter(s => {
      if (statusFilter === 'validee' && s.statut !== 'validee') return false;
      if (statusFilter === 'en_cours' && s.statut !== 'en_cours') return false;
      if (statusFilter === 'expiree' && !(s.statut === 'validee' && new Date(s.date_expiration) < new Date())) return false;
      if (search) {
        const q = search.toLowerCase();
        const nom = (s.valideur || '').toLowerCase();
        const mat = (s.operateur_matricule || '').toLowerCase();
        return nom.includes(q) || mat.includes(q) || String(s.id).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'created_at' || sortField === 'date_expiration') {
        va = new Date(va || 0); vb = new Date(vb || 0);
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  // Helpers
  const getValiditeBadge = (session) => {
    if (session.statut === 'en_cours') {
      // Vérifier si la session en_cours est expirée
      if (session.date_expiration && new Date(session.date_expiration) < new Date()) {
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Expirée (non validée)</span>;
      }
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Timer className="w-3 h-3" /> En cours</span>;
    }
    const exp = new Date(session.date_expiration);
    const now = new Date();
    const hoursLeft = (exp - now) / (1000 * 60 * 60);
    if (hoursLeft < 0) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Expirée</span>;
    }
    if (hoursLeft < 2) {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><AlertTriangle className="w-3 h-3" /> Expire bientôt</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3" /> Valide</span>;
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDuree = (min) => {
    if (!min && min !== 0) return '—';
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  };

  if (!typeInfo) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Type de checklist invalide</p>
      </div>
    );
  }

  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  };
  const cc = colorClasses[typeInfo.color] || colorClasses.blue;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${cc.bg}`}>
            <IconComp className={`w-7 h-7 ${cc.icon}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checklist {typeInfo.label}</h1>
            <p className="text-sm text-gray-500">
              Fréquence : {typeInfo.freq}
              {type && ` · ${type.total_items} points de contrôle · ${type.total_critiques} critiques`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Statut validité actuelle */}
          {type && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${type.est_valide ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {type.est_valide ? (
                <>
                  <Shield className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Valide ({type.expire_dans}h restantes)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Expirée / Non effectuée</span>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Checklist
          </button>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par N°, opérateur..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="validee">Validées</option>
              <option value="en_cours">En cours</option>
              <option value="expiree">Expirées</option>
            </select>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            <span className="ml-3 text-gray-500">Chargement...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-lg font-medium">Aucune checklist trouvée</p>
            <p className="text-sm mt-1">Créez une nouvelle checklist pour commencer</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => toggleSort('id')}>
                      <div className="flex items-center gap-1">N° <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => toggleSort('created_at')}>
                      <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opérateur</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Contrôles</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Critiques</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Durée</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Validité</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700" onClick={() => toggleSort('date_expiration')}>
                      <div className="flex items-center gap-1">Échéance <ArrowUpDown className="w-3 h-3" /></div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((s) => {
                    const totalChecks = Number(s.conformes || 0) + Number(s.non_conformes || 0) + Number(s.corriges || 0);
                    const critiquesOk = Number(s.conformes || 0);
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${cc.badge}`}>
                            {s.numero || s.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{s.valideur?.trim() || '—'}</p>
                              {s.operateur_matricule && (
                                <p className="text-xs text-gray-400">{s.operateur_matricule}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-sm font-medium text-green-600">{totalChecks}</span>
                            <span className="text-xs text-gray-400">/ {s.total_items}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {Number(s.non_conformes) > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3" /> {s.non_conformes}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">{formatDuree(s.duree_minutes)}</td>
                        <td className="px-4 py-3 text-center">{getValiditeBadge(s)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(s.date_expiration)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => navigate(`/checklist-periodique/${s.id}`)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="Voir / Continuer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await checklistPeriodiqueApi.getSession(s.id);
                                  generateChecklistPdf(res.data.session, res.data.categories, res.data.stats);
                                  addToast('PDF téléchargé', 'success');
                                } catch (err) {
                                  console.error(err);
                                  addToast('Erreur lors de la génération du PDF', 'error');
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
                              title="Télécharger PDF"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-500">
                  {filtered.length} checklist{filtered.length > 1 ? 's' : ''} · Page {page}/{totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    if (p > totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === page ? 'bg-teal-600 text-white' : 'hover:bg-gray-200 text-gray-600'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Nouvelle Checklist */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-fadeIn">
            <div className={`px-6 py-4 border-b border-gray-200 ${cc.bg} rounded-t-2xl`}>
              <h2 className={`text-lg font-bold ${cc.text}`}>Nouvelle Checklist {typeInfo.label}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{type?.total_items} points · Validité : {typeInfo.freq}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" /> Opérateur
                </label>
                <select
                  value={selectedOperateur}
                  onChange={e => setSelectedOperateur(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Sélectionner un opérateur...</option>
                  {operateurs.map(op => (
                    <option key={op.id} value={op.id}>
                      {op.prenom} {op.nom} — {op.matricule}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { setShowNewModal(false); setSelectedOperateur(''); }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedOperateur || creating}
                className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Créer et remplir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
