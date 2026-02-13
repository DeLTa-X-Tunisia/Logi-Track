/**
 * Page Historique Checklist Machine
 * Consultation de toutes les validations par coulée, avec détail complet
 */

import { useState, useEffect } from 'react';
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle, Wrench,
  Search, Eye, X, Clock, RefreshCw, ChevronDown, ChevronUp,
  Zap, ArrowLeft
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';

// Icônes par catégorie
const CATEGORY_ICONS = {
  DEROULAGE: '🔄', GMAW: '🔩', FORMAGE: '⚙️', SOUDURE_FINALE: '🔥',
  REFROIDISSEMENT: '❄️', CONTROLE: '📊', SECURITE: '🛡️', SOUDAGE: '🔥'
};

const STATUT_BADGE = {
  conforme: { bg: 'bg-green-100 text-green-700', label: 'Conforme', icon: CheckCircle },
  non_conforme: { bg: 'bg-red-100 text-red-700', label: 'Non conforme', icon: XCircle },
  corrige: { bg: 'bg-blue-100 text-blue-700', label: 'Corrigé', icon: Wrench },
  non_verifie: { bg: 'bg-gray-100 text-gray-500', label: 'Non vérifié', icon: Clock }
};

export default function HistoriqueChecklist() {
  const { showToast } = useToast();
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchHistorique();
  }, []);

  const fetchHistorique = async () => {
    try {
      setLoading(true);
      const res = await api.get('/checklist/historique');
      setHistorique(res.data);
    } catch (error) {
      showToast('Erreur chargement historique', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (couleeId) => {
    setDetailLoading(true);
    setShowDetail(couleeId);
    try {
      const res = await api.get(`/checklist/historique/${couleeId}`);
      setDetailData(res.data);
    } catch (error) {
      showToast('Erreur chargement détail', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = historique.filter(h => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return h.numero?.toLowerCase().includes(q) ||
           h.validateur?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-teal-500" />
            Historique Checklist Machine
          </h1>
          <p className="text-gray-500 mt-1">Traçabilité des validations par coulée</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            {historique.length} validation{historique.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par numéro de coulée ou validateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button onClick={fetchHistorique} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune checklist validée trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Coulée</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date Validation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Validateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Résultat</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-amber-600">{item.numero}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.date_checklist && new Date(item.date_checklist).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                      {item.validateur || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {item.checklist_validation_rapide ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <Zap className="w-3 h-3" />
                          Rapide
                          {item.source_coulee_numero && (
                            <span className="text-blue-500 ml-0.5">(N°{item.source_coulee_numero})</span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Complète
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded" title="Conformes">
                          {item.nb_conformes}
                        </span>
                        {item.nb_non_conformes > 0 && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded" title="Non conformes">
                            {item.nb_non_conformes}
                          </span>
                        )}
                        {item.nb_corriges > 0 && (
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded" title="Corrigés">
                            {item.nb_corriges}
                          </span>
                        )}
                        <span className="text-gray-400">/ {item.nb_total}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openDetail(item.id)}
                        className="p-2 text-teal-500 hover:bg-teal-50 rounded-lg"
                        title="Voir le détail"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Détail */}
      {showDetail && (
        <DetailChecklistModal
          data={detailData}
          loading={detailLoading}
          onClose={() => { setShowDetail(null); setDetailData(null); }}
        />
      )}
    </div>
  );
}

// Modal Détail Checklist
function DetailChecklistModal({ data, loading, onClose }) {
  const [expandedCats, setExpandedCats] = useState({});

  // Ouvrir toutes les catégories au chargement
  useEffect(() => {
    if (data?.categories) {
      const all = {};
      data.categories.forEach(c => { all[c.code] = true; });
      setExpandedCats(all);
    }
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-teal-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-teal-600" />
              Checklist — Coulée N°<span className="font-mono">{data?.coulee?.numero}</span>
            </h2>
            {data?.coulee && (
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                <span>
                  {data.coulee.date_checklist && new Date(data.coulee.date_checklist).toLocaleString('fr-FR')}
                </span>
                {data.coulee.validateur && (
                  <span>par <strong>{data.coulee.validateur}</strong></span>
                )}
                {data.coulee.checklist_validation_rapide ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    <Zap className="w-3 h-3" /> Validation rapide
                    {data.coulee.source_coulee_numero && ` (reprise N°${data.coulee.source_coulee_numero})`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                    <CheckCircle className="w-3 h-3" /> Complète
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-teal-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : data?.categories ? (
            <div className="space-y-4">
              {data.categories.map((cat) => {
                const conformes = cat.items.filter(i => i.statut === 'conforme').length;
                const nonConformes = cat.items.filter(i => i.statut === 'non_conforme').length;
                const corriges = cat.items.filter(i => i.statut === 'corrige').length;
                const isOpen = expandedCats[cat.code];

                return (
                  <div key={cat.code} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedCats(prev => ({ ...prev, [cat.code]: !prev[cat.code] }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{CATEGORY_ICONS[cat.code] || '📋'}</span>
                        <span className="font-semibold text-gray-900">{cat.nom}</span>
                        <div className="flex gap-1.5 text-xs">
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{conformes}</span>
                          {nonConformes > 0 && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{nonConformes}</span>}
                          {corriges > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{corriges}</span>}
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {isOpen && (
                      <div className="divide-y divide-gray-100">
                        {cat.items.map((item, idx) => {
                          const s = STATUT_BADGE[item.statut] || STATUT_BADGE.non_verifie;
                          const StatusIcon = s.icon;
                          return (
                            <div key={idx} className="px-4 py-3 flex items-start gap-3">
                              <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                                item.statut === 'conforme' ? 'text-green-500' :
                                item.statut === 'non_conforme' ? 'text-red-500' :
                                item.statut === 'corrige' ? 'text-blue-500' : 'text-gray-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">{item.libelle}</span>
                                  {item.critique && (
                                    <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">CRITIQUE</span>
                                  )}
                                </div>
                                {item.defaut_detecte && (
                                  <div className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded">
                                    <strong>Défaut :</strong> {item.defaut_detecte}
                                  </div>
                                )}
                                {item.action_corrective && (
                                  <div className="mt-1 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                                    <strong>Correction :</strong> {item.action_corrective}
                                  </div>
                                )}
                                {item.commentaire && (
                                  <div className="mt-1 text-xs text-gray-500 italic">{item.commentaire}</div>
                                )}
                                <div className="mt-1 text-xs text-gray-400">
                                  {item.date_verification && (
                                    <span>Vérifié : {new Date(item.date_verification).toLocaleString('fr-FR')}</span>
                                  )}
                                  {item.verificateur && <span> — par {item.verificateur}</span>}
                                </div>
                              </div>
                              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${s.bg}`}>
                                {s.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune donnée</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
