import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { checklistPeriodiqueApi } from '../services/api';
import {
  ArrowLeft,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  Clock,
  RefreshCw,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Save,
  RotateCcw,
  BadgeCheck,
  User,
  Timer,
  CalendarCheck
} from 'lucide-react';

const TYPE_CODE_TO_SLUG = {
  'DEBUT_QUART': 'debut-quart',
  'HEBDOMADAIRE': 'hebdomadaire',
  'MENSUELLE': 'mensuelle',
};

export default function ChecklistPeriodique() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [defautModal, setDefautModal] = useState(null);
  const [defautForm, setDefautForm] = useState({ defaut: '', action: '', commentaire: '' });
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatElapsed = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const loadData = useCallback(async () => {
    try {
      const res = await checklistPeriodiqueApi.getSession(sessionId);
      setSession(res.data.session);
      setCategories(res.data.categories);
      setStats(res.data.stats);

      // Auto-expand toutes les catégories
      const expanded = {};
      res.data.categories.forEach(cat => { expanded[cat.id] = true; });
      setExpandedCategories(prev => {
        const hasKeys = Object.keys(prev).length > 0;
        return hasKeys ? prev : expanded;
      });
    } catch (err) {
      console.error('Erreur chargement session:', err);
      addToast('Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionId, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ----------- Actions item ----------- */

  const handleValidateConforme = async (itemId) => {
    try {
      await checklistPeriodiqueApi.validateItem({
        session_id: parseInt(sessionId),
        item_id: itemId,
        statut: 'conforme'
      });
      await loadData();
    } catch (err) {
      addToast('Erreur validation', 'error');
    }
  };

  const handleSaveDefaut = async () => {
    if (!defautModal || !defautForm.defaut) return;
    setSaving(true);
    try {
      await checklistPeriodiqueApi.validateItem({
        session_id: parseInt(sessionId),
        item_id: defautModal.id,
        statut: defautForm.action ? 'corrige' : 'non_conforme',
        defaut_detecte: defautForm.defaut,
        action_corrective: defautForm.action || null,
        commentaire: defautForm.commentaire || null
      });
      setDefautModal(null);
      setDefautForm({ defaut: '', action: '', commentaire: '' });
      await loadData();
      addToast(defautForm.action ? 'Défaut corrigé enregistré' : 'Non-conformité signalée', 
        defautForm.action ? 'success' : 'warning');
    } catch (err) {
      addToast('Erreur enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetItem = async (itemId) => {
    try {
      await checklistPeriodiqueApi.validateItem({
        session_id: parseInt(sessionId),
        item_id: itemId,
        statut: 'non_verifie'
      });
      await loadData();
    } catch (err) {
      addToast('Erreur réinitialisation', 'error');
    }
  };

  const handleValidateCategory = async (category) => {
    const nonValidated = category.items.filter(it => !it.validation || it.validation.statut === 'non_verifie');
    if (nonValidated.length === 0) return;

    for (const item of nonValidated) {
      await checklistPeriodiqueApi.validateItem({
        session_id: parseInt(sessionId),
        item_id: item.id,
        statut: 'conforme'
      });
    }
    await loadData();
    addToast(`${category.nom} — ${nonValidated.length} items validés`, 'success');
  };

  const handleValidateSession = async () => {
    const ok = await confirm({
      title: 'Valider la checklist',
      message: `Confirmer la validation complète de la checklist "${session?.type_nom}" ?\nOpérateur: ${session?.operateur_nom?.trim() || 'Non assigné'}\nDurée: ${formatElapsed(elapsed)}`,
      confirmText: 'Valider et finaliser',
      type: 'info'
    });
    if (!ok) return;

    setValidating(true);
    try {
      await checklistPeriodiqueApi.validateSession(sessionId);
      addToast('Checklist périodique validée avec succès !', 'success');
      const slug = TYPE_CODE_TO_SLUG[session?.type_code] || 'debut-quart';
      navigate(`/checklists/${slug}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur validation';
      addToast(msg, 'error');
    } finally {
      setValidating(false);
    }
  };

  /* ----------- Helpers ----------- */

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const getCategoryProgress = (category) => {
    const total = category.items.length;
    const done = category.items.filter(it => it.validation && it.validation.statut !== 'non_verifie').length;
    return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  /* ----------- Render ----------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Chargement de la checklist...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Session non trouvée</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary-600 hover:underline">
          Retour aux checklists
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const slug = TYPE_CODE_TO_SLUG[session?.type_code] || 'debut-quart';
              navigate(`/checklists/${slug}`);
            }}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-7 h-7 text-primary-600" />
              {session.type_nom}
            </h1>
            <div className="flex items-center gap-4 mt-0.5">
              <span className="text-gray-500 text-sm">{session.frequence} — Session #{session.id}</span>
              {session.operateur_nom?.trim() && (
                <span className="text-sm text-primary-600 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  {session.operateur_nom.trim()}
                  {session.operateur_matricule && <span className="text-gray-400">({session.operateur_matricule})</span>}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Timer */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 border border-gray-200">
          <Timer className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-mono font-medium text-gray-700">{formatElapsed(elapsed)}</span>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} icon={Shield} color="text-gray-600" bg="bg-gray-50" />
          <StatCard label="Conformes" value={stats.conformes} icon={CheckCircle2} color="text-success-600" bg="bg-success-50" />
          <StatCard label="Non conformes" value={stats.non_conformes} icon={XCircle} color="text-danger-600" bg="bg-danger-50" />
          <StatCard label="Corrigés" value={stats.corriges} icon={Wrench} color="text-warning-600" bg="bg-warning-50" />
          <StatCard label="Non vérifiés" value={stats.non_verifies} icon={Clock} color="text-gray-400" bg="bg-gray-50" />
        </div>
      )}

      {/* Progress + validate button */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">
              Progression: {stats.conformes + stats.corriges}/{stats.total}
            </span>
            <span className="text-sm font-bold text-primary-600">{stats.progression}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                stats.progression === 100 ? 'bg-success-500' : 'bg-primary-500'
              }`}
              style={{ width: `${stats.progression}%` }}
            />
          </div>

          {stats.peut_valider && (
            <button
              onClick={handleValidateSession}
              disabled={validating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-success-600 text-white font-semibold hover:bg-success-700 transition-colors shadow-sm"
            >
              {validating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <BadgeCheck className="w-5 h-5" />
              )}
              Valider la checklist
            </button>
          )}

          {stats.deja_validee && (
            <div className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-green-50 border-2 border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <span className="text-sm font-semibold text-green-700">Checklist déjà validée</span>
                {stats.est_expiree && <span className="text-xs text-red-500 ml-2">· Expirée</span>}
              </div>
            </div>
          )}

          {stats.est_expiree && !stats.deja_validee && (
            <div className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-red-50 border-2 border-red-200">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <span className="text-sm font-semibold text-red-700">Checklist expirée</span>
                <span className="text-xs text-red-500 ml-2">Veuillez créer une nouvelle session</span>
              </div>
            </div>
          )}

          {stats.critiques_non_valides > 0 && (
            <p className="text-sm text-danger-600 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {stats.critiques_non_valides} point(s) critique(s) non validé(s)
            </p>
          )}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {categories.map(category => {
          const { done, total, percent } = getCategoryProgress(category);
          const isExpanded = expandedCategories[category.id];
          const allDone = done === total;
          const nonValidated = category.items.filter(it => !it.validation || it.validation.statut === 'non_verifie');

          return (
            <div key={category.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded
                    ? <ChevronDown className="w-5 h-5 text-gray-400" />
                    : <ChevronRight className="w-5 h-5 text-gray-400" />
                  }
                  <span className="font-semibold text-gray-900">{category.nom}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {done}/{total}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {allDone ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success-700 bg-success-100 px-2.5 py-1 rounded-full">
                      <CheckCheck className="w-3.5 h-3.5" />
                      Validée
                    </span>
                  ) : (
                    !stats?.est_expiree && !stats?.deja_validee && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleValidateCategory(category); }}
                      className="flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full hover:bg-primary-200 cursor-pointer transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Tout valider ({nonValidated.length})
                    </span>
                    )
                  )}
                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${allDone ? 'bg-success-500' : 'bg-primary-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Items — Compact card layout */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {category.items.map(item => {
                    const v = item.validation;
                    const isDone = v && v.statut !== 'non_verifie';
                    const isConforme = v?.statut === 'conforme';
                    const isCorrige = v?.statut === 'corrige';
                    const isNC = v?.statut === 'non_conforme';

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isConforme ? 'border-success-200 bg-success-50/50' :
                          isCorrige ? 'border-warning-200 bg-warning-50/50' :
                          isNC ? 'border-danger-200 bg-danger-50/50' :
                          'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {/* Row 1: Libelle + badges */}
                        <div className="flex items-start gap-2 mb-2">
                          {isConforme && <CheckCircle2 className="w-5 h-5 text-success-600 mt-0.5 flex-shrink-0" />}
                          {isCorrige && <Wrench className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />}
                          {isNC && <XCircle className="w-5 h-5 text-danger-600 mt-0.5 flex-shrink-0" />}
                          {!isDone && <div className="w-5 h-5 rounded-full border-2 border-gray-300 mt-0.5 flex-shrink-0" />}
                          <span className={`text-sm font-medium leading-tight ${isDone ? 'text-gray-500' : 'text-gray-900'}`}>
                            {item.libelle}
                          </span>
                        </div>

                        {/* Row 2: Tags */}
                        <div className="flex items-center gap-2 mb-2.5 ml-7">
                          {!!item.critique && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-danger-100 text-danger-700 font-semibold">
                              CRITIQUE
                            </span>
                          )}
                          {isDone && v.date_verification && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                              <CalendarCheck className="w-3 h-3" />
                              {formatTimestamp(v.date_verification)}
                            </span>
                          )}
                          {isDone && v.valideur && (
                            <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                              <User className="w-3 h-3" />
                              {v.valideur}
                            </span>
                          )}
                        </div>

                        {/* Defaut info if NC or corrected */}
                        {isDone && v.defaut_detecte && (
                          <div className="ml-7 mb-2.5 text-xs space-y-0.5">
                            <p className="text-danger-600"><span className="font-medium">Défaut:</span> {v.defaut_detecte}</p>
                            {v.action_corrective && (
                              <p className="text-warning-600"><span className="font-medium">Action:</span> {v.action_corrective}</p>
                            )}
                          </div>
                        )}

                        {/* Row 3: Action buttons — DIRECTLY UNDER TEXT */}
                        <div className="ml-7">
                          {(stats?.est_expiree || stats?.deja_validee) ? (
                            stats?.deja_validee ? null : <span className="text-xs text-red-400 italic">Session expirée</span>
                          ) : !isDone ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleValidateConforme(item.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-100 text-success-700 hover:bg-success-200 transition-colors text-xs font-medium"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Conforme
                              </button>
                              <button
                                onClick={() => { setDefautModal(item); setDefautForm({ defaut: '', action: '', commentaire: '' }); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-100 text-danger-700 hover:bg-danger-200 transition-colors text-xs font-medium"
                              >
                                <XCircle className="w-4 h-4" />
                                Non conforme
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleResetItem(item.id)}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Réinitialiser
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Defaut modal */}
      {defautModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Signaler un défaut</h3>
            <p className="text-sm text-gray-500 mb-4">{defautModal.libelle}</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Défaut détecté *</label>
                <input
                  type="text"
                  value={defautForm.defaut}
                  onChange={e => setDefautForm(prev => ({ ...prev, defaut: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Description du défaut..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action corrective</label>
                <input
                  type="text"
                  value={defautForm.action}
                  onChange={e => setDefautForm(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Si corrigé, décrivez l'action..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                  Commentaire
                </label>
                <textarea
                  value={defautForm.commentaire}
                  onChange={e => setDefautForm(prev => ({ ...prev, commentaire: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none"
                  placeholder="Remarques supplémentaires..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDefautModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveDefaut}
                disabled={!defautForm.defaut || saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
