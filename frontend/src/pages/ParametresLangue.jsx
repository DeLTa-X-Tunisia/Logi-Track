import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import api from '../services/api';

const FlagIcon = ({ code, size = 24 }) => (
  <img
    src={`https://flagcdn.com/w40/${code}.png`}
    srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
    width={size}
    alt={code}
    className="inline-block rounded-sm shadow-sm"
    style={{ aspectRatio: '4/3', objectFit: 'cover' }}
  />
);
import {
  Languages,
  Globe,
  Star,
  ToggleLeft,
  ToggleRight,
  Search,
  Edit3,
  Check,
  X,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  ChevronDown,
  Filter
} from 'lucide-react';

export default function ParametresLangue() {
  const { isAdmin } = useAuth();
  const { t, reloadTranslations, allLangues } = useTranslation();
  const toast = useToast();

  const [langues, setLangues] = useState([]);
  const [traductions, setTraductions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('langues'); // 'langues' ou 'traductions'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('all');
  const [editingCell, setEditingCell] = useState(null); // { cle, langue_code }
  const [editValue, setEditValue] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTraduction, setNewTraduction] = useState({ cle: '', categorie: 'general', traductions: {} });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [languesRes, traductionsRes] = await Promise.all([
        api.get('/langues'),
        api.get('/langues/traductions-all')
      ]);
      setLangues(languesRes.data.langues || []);
      setTraductions(traductionsRes.data.traductions || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLangue = async (id) => {
    try {
      await api.put(`/langues/${id}/toggle`);
      const res = await api.get('/langues');
      setLangues(res.data.langues);
      reloadTranslations();
      toast.success('Langue mise à jour');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      const res = await api.put(`/langues/${id}/defaut`);
      setLangues(res.data.langues);
      toast.success('Langue par défaut mise à jour');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  const handleStartEdit = (cle, langue_code, currentValue) => {
    setEditingCell({ cle, langue_code });
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    try {
      await api.put('/langues/traduction', {
        cle: editingCell.cle,
        langue_code: editingCell.langue_code,
        valeur: editValue
      });

      // Mettre à jour localement
      setTraductions(prev => prev.map(t => {
        if (t.cle === editingCell.cle) {
          return { ...t, traductions: { ...t.traductions, [editingCell.langue_code]: editValue } };
        }
        return t;
      }));

      setEditingCell(null);
      setEditValue('');
      reloadTranslations();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleAddTraduction = async () => {
    if (!newTraduction.cle.trim()) {
      toast.error('La clé est requise');
      return;
    }

    try {
      await api.post('/langues/traduction', {
        cle: newTraduction.cle,
        categorie: newTraduction.categorie,
        traductions: newTraduction.traductions
      });

      setShowAddModal(false);
      setNewTraduction({ cle: '', categorie: 'general', traductions: {} });
      fetchData();
      reloadTranslations();
      toast.success('Traduction ajoutée');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleDeleteTraduction = async (cle) => {
    if (!confirm(`Supprimer la clé "${cle}" et toutes ses traductions ?`)) return;
    try {
      await api.delete(`/langues/traduction/${encodeURIComponent(cle)}`);
      setTraductions(prev => prev.filter(t => t.cle !== cle));
      reloadTranslations();
      toast.success('Traduction supprimée');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  // Catégories disponibles
  const categories = [...new Set(traductions.map(t => t.categorie))].sort();

  // Filtrer les traductions
  const filteredTraductions = traductions.filter(t => {
    const matchSearch = !searchTerm ||
      t.cle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(t.traductions).some(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategorie = filterCategorie === 'all' || t.categorie === filterCategorie;
    return matchSearch && matchCategorie;
  });

  const activeLangCodes = langues.filter(l => l.actif).map(l => l.code);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-3" />
          <p className="text-gray-600">Accès réservé aux administrateurs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
            <Languages className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('langue.titre')}</h1>
            <p className="text-sm text-gray-500">{t('langue.description')}</p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('langues')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'langues'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="w-4 h-4" />
          {t('langue.langues_disponibles')}
        </button>
        <button
          onClick={() => setActiveTab('traductions')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'traductions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          {t('langue.traductions')}
        </button>
      </div>

      {/* Tab: Langues */}
      {activeTab === 'langues' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {langues.map((langue) => (
            <div
              key={langue.id}
              className={`bg-white rounded-2xl shadow-sm border-2 p-5 transition-all ${
                langue.par_defaut ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FlagIcon code={langue.drapeau} size={36} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{langue.nom}</h3>
                      <span className="text-sm text-gray-400">({langue.nom_natif})</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                        {langue.code.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {langue.direction === 'rtl' ? '← RTL' : 'LTR →'}
                      </span>
                      {langue.par_defaut && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                          <Star className="w-3 h-3" />
                          {t('langue.par_defaut')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle actif/inactif */}
                  <button
                    onClick={() => handleToggleLangue(langue.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      langue.actif
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={langue.actif ? 'Désactiver' : 'Activer'}
                  >
                    {langue.actif ? (
                      <ToggleRight className="w-7 h-7" />
                    ) : (
                      <ToggleLeft className="w-7 h-7" />
                    )}
                  </button>

                  {/* Définir par défaut */}
                  {!langue.par_defaut && langue.actif && (
                    <button
                      onClick={() => handleSetDefault(langue.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      title="Définir comme langue par défaut"
                    >
                      <Star className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Traductions */}
      {activeTab === 'traductions' && (
        <div className="space-y-4">
          {/* Barre d'outils */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('common.rechercher')}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterCategorie}
                onChange={(e) => setFilterCategorie(e.target.value)}
                className="pl-10 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">Toutes les catégories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => {
                setNewTraduction({
                  cle: '',
                  categorie: 'general',
                  traductions: Object.fromEntries(activeLangCodes.map(c => [c, '']))
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nouvelle clé
            </button>
          </div>

          {/* Info count */}
          <p className="text-sm text-gray-500">
            {filteredTraductions.length} traduction{filteredTraductions.length > 1 ? 's' : ''}
            {searchTerm && ` pour "${searchTerm}"`}
          </p>

          {/* Tableau des traductions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-48">Clé</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-20">Cat.</th>
                    {langues.filter(l => l.actif).map(l => (
                      <th key={l.code} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                        <span className="flex items-center gap-1.5">
                          <FlagIcon code={l.drapeau} size={18} />
                          {l.code.toUpperCase()}
                        </span>
                      </th>
                    ))}
                    <th className="text-center px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTraductions.map((trad) => (
                    <tr key={trad.cle} className="hover:bg-gray-50 group">
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded font-mono">
                          {trad.cle}
                        </code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-400">{trad.categorie}</span>
                      </td>
                      {langues.filter(l => l.actif).map(l => (
                        <td key={l.code} className="px-4 py-2.5">
                          {editingCell?.cle === trad.cle && editingCell?.langue_code === l.code ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="w-full px-2 py-1 text-sm border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                autoFocus
                                dir={l.direction}
                              />
                              <button onClick={handleSaveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={handleCancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(trad.cle, l.code, trad.traductions[l.code])}
                              className="text-sm text-gray-700 hover:text-primary-600 hover:bg-primary-50 px-2 py-1 rounded transition-colors text-left w-full"
                              dir={l.direction}
                              title="Cliquer pour modifier"
                            >
                              {trad.traductions[l.code] || (
                                <span className="text-gray-300 italic text-xs">non traduit</span>
                              )}
                            </button>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteTraduction(trad.cle)}
                          className="p-1 text-gray-300 hover:text-danger-600 hover:bg-danger-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajout Traduction */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                Nouvelle Traduction
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clé</label>
                  <input
                    type="text"
                    value={newTraduction.cle}
                    onChange={(e) => setNewTraduction(prev => ({ ...prev, cle: e.target.value }))}
                    placeholder="ex: bobines.poids"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <select
                    value={newTraduction.categorie}
                    onChange={(e) => setNewTraduction(prev => ({ ...prev, categorie: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="custom">custom</option>
                  </select>
                </div>
              </div>

              {langues.filter(l => l.actif).map(l => (
                <div key={l.code}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <span className="inline-flex items-center gap-1.5"><FlagIcon code={l.drapeau} size={18} /> {l.nom}</span>
                  </label>
                  <input
                    type="text"
                    value={newTraduction.traductions[l.code] || ''}
                    onChange={(e) => setNewTraduction(prev => ({
                      ...prev,
                      traductions: { ...prev.traductions, [l.code]: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    dir={l.direction}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-sm font-medium transition-colors"
              >
                {t('common.annuler')}
              </button>
              <button
                onClick={handleAddTraduction}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 text-sm font-medium shadow-lg shadow-emerald-500/25"
              >
                <Save className="w-4 h-4" />
                {t('common.sauvegarder')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
