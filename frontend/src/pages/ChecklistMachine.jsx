import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Wrench,
  ArrowLeft,
  Save,
  Clock,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  CheckCheck
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { useTranslation } from '../context/I18nContext';

// Icônes par catégorie
const CATEGORY_ICONS = {
  DEROULAGE: '🔄',
  GMAW: '🔩',
  FORMAGE: '⚙️',
  SOUDURE_FINALE: '🔥',
  REFROIDISSEMENT: '❄️',
  CONTROLE: '📊',
  SECURITE: '🛡️',
  // Rétrocompatibilité anciens codes
  SOUDAGE: '🔥'
};

// Couleurs par statut
const STATUS_COLORS = {
  non_verifie: 'bg-gray-100 text-gray-600 border-gray-300',
  conforme: 'bg-green-100 text-green-700 border-green-500',
  non_conforme: 'bg-red-100 text-red-700 border-red-500',
  corrige: 'bg-blue-100 text-blue-700 border-blue-500'
};

export default function ChecklistMachine() {
  const { couleeId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();

  const getStatusLabel = (status) => {
    const labels = {
      non_verifie: t('checklist.non_verifie'),
      conforme: t('checklist.conforme'),
      non_conforme: t('checklist.non_conforme'),
      corrige: t('checklist.corrige')
    };
    return labels[status] || status;
  };
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couleeInfo, setCouleeInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [validations, setValidations] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    defaut_detecte: '',
    action_corrective: '',
    commentaire: ''
  });
  const [checklistComplete, setChecklistComplete] = useState(false);
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    conformes: 0,
    progression: 0,
    critiques_non_valides: 0,
    peut_valider: false
  });

  // Charger les données
  useEffect(() => {
    loadData();
  }, [couleeId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Charger les infos de la coulée
      const couleeRes = await api.get(`/coulees/${couleeId}`);
      setCouleeInfo(couleeRes.data);
      
      // Charger le statut de la checklist pour cette coulée
      const checklistRes = await api.get(`/checklist/coulee/${couleeId}`);
      const { categories: cats, stats } = checklistRes.data;
      
      setCategories(cats);
      setChecklistComplete(!!couleeRes.data?.checklist_validee);
      setGlobalStats(stats);
      
      // Extraire les validations depuis les items des catégories
      const valsMap = {};
      cats.forEach(cat => {
        cat.items.forEach(item => {
          if (item.validation) {
            valsMap[item.id] = item.validation;
          }
        });
      });
      setValidations(valsMap);
      
      // Ouvrir toutes les catégories par défaut
      const expanded = {};
      cats.forEach(cat => {
        expanded[cat.id] = true;
      });
      setExpandedCategories(expanded);
      
    } catch (err) {
      console.error('Erreur chargement checklist:', err);
      showToast(t('common.erreur'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Valider un item comme conforme
  const handleValidateConforme = async (itemId) => {
    try {
      setSaving(true);
      await api.put('/checklist/valider-item', {
        coulee_id: parseInt(couleeId),
        item_id: itemId,
        statut: 'conforme'
      });
      await loadData();
    } catch (err) {
      console.error('Erreur validation:', err);
      showToast(t('common.erreur'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Ouvrir le formulaire pour signaler un défaut
  const handleOpenDefautForm = (item) => {
    setEditingItem(item);
    const existingValidation = validations[item.id];
    setFormData({
      defaut_detecte: existingValidation?.defaut_detecte || '',
      action_corrective: existingValidation?.action_corrective || '',
      commentaire: existingValidation?.commentaire || ''
    });
  };

  // Sauvegarder un défaut/correction
  const handleSaveDefaut = async (statut) => {
    if (!editingItem) return;
    
    try {
      setSaving(true);
      await api.put('/checklist/valider-item', {
        coulee_id: parseInt(couleeId),
        item_id: editingItem.id,
        statut,
        defaut_detecte: formData.defaut_detecte || null,
        action_corrective: formData.action_corrective || null,
        commentaire: formData.commentaire || null
      });
      setEditingItem(null);
      setFormData({ defaut_detecte: '', action_corrective: '', commentaire: '' });
      await loadData();
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      showToast(t('common.erreur'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser un item
  const handleResetItem = async (itemId) => {
    try {
      setSaving(true);
      await api.put('/checklist/valider-item', {
        coulee_id: parseInt(couleeId),
        item_id: itemId,
        statut: 'non_verifie'
      });
      await loadData();
    } catch (err) {
      console.error('Erreur réinitialisation:', err);
    } finally {
      setSaving(false);
    }
  };

  // Validation finale de la checklist
  const handleValidationFinale = async () => {
    if (!globalStats.peut_valider) {
      if (globalStats.critiques_non_valides > 0) {
        showToast(`${globalStats.critiques_non_valides} ${t('checklist.points_critiques')}`, 'error');
      } else {
        showToast(t('common.erreur'), 'error');
      }
      return;
    }
    
    try {
      setSaving(true);
      await api.post(`/checklist/valider-complete/${couleeId}`);
      showToast(t('checklist.msg_validee'), 'success');
      navigate(`/coulees?open=${couleeId}`);
    } catch (err) {
      console.error('Erreur validation finale:', err);
      showToast(err.response?.data?.error || t('common.erreur'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Valider tous les items d'une catégorie en un clic
  const handleValidateCategory = async (category) => {
    const itemsToValidate = category.items?.filter(item => {
      const v = validations[item.id];
      return !v || v.statut === 'non_verifie';
    }) || [];
    
    if (itemsToValidate.length === 0) {
      showToast(t('checklist.msg_section_validee'), 'info');
      return;
    }
    
    try {
      setSaving(true);
      for (const item of itemsToValidate) {
        await api.put('/checklist/valider-item', {
          coulee_id: parseInt(couleeId),
          item_id: item.id,
          statut: 'conforme'
        });
      }
      showToast(`${itemsToValidate.length} point(s) validé(s) pour ${category.nom}`, 'success');
      await loadData();
    } catch (err) {
      console.error('Erreur validation catégorie:', err);
      showToast(t('common.erreur'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle catégorie
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Rendre un item de checklist
  const renderItem = (item) => {
    const validation = validations[item.id];
    const statut = validation?.statut || 'non_verifie';
    const statusColors = STATUS_COLORS[statut];
    
    return (
      <div 
        key={item.id} 
        className={`border rounded-lg p-4 mb-2 ${statusColors} ${item.critique ? 'border-l-4 border-l-red-500' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.libelle}</span>
              {item.critique && (
                <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                  {t('checklist.critique')}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm opacity-75 mt-1">{item.description}</p>
            )}
            
            {/* Infos de validation */}
            {validation && statut !== 'non_verifie' && (
              <div className="mt-2 text-xs space-y-1">
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{t('checklist.verifie_le')} {new Date(validation.date_verification).toLocaleString('fr-FR')}</span>
                </div>
                {validation.operateur_nom && (
                  <div className="flex items-center gap-1">
                    <User size={12} />
                    <span>{t('checklist.par')} {validation.operateur_nom}</span>
                  </div>
                )}
                {validation.defaut_detecte && (
                  <div className="flex items-start gap-1 mt-2 p-2 bg-white/50 rounded">
                    <AlertTriangle size={12} className="mt-0.5 text-orange-600" />
                    <div>
                      <strong>{t('checklist.defaut_label')}</strong> {validation.defaut_detecte}
                    </div>
                  </div>
                )}
                {validation.action_corrective && (
                  <div className="flex items-start gap-1 mt-1 p-2 bg-white/50 rounded">
                    <Wrench size={12} className="mt-0.5 text-blue-600" />
                    <div>
                      <strong>{t('checklist.correction_label')}</strong> {validation.action_corrective}
                    </div>
                  </div>
                )}
                {validation.date_correction && (
                  <div className="text-xs mt-1 text-blue-600">
                    {t('checklist.corrige_le')} {new Date(validation.date_correction).toLocaleString('fr-FR')}
                    {validation.operateur_correction_nom && ` par ${validation.operateur_correction_nom}`}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex flex-col gap-1 ml-4">
            {statut === 'non_verifie' && (
              <>
                <button
                  onClick={() => handleValidateConforme(item.id)}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  title="Marquer comme conforme"
                >
                  <CheckCircle2 size={14} />
                  {t('checklist.btn_conforme')}
                </button>
                <button
                  onClick={() => handleOpenDefautForm(item)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  title={t('checklist.signaler_defaut')}
                >
                  <XCircle size={14} />
                  {t('checklist.btn_defaut')}
                </button>
              </>
            )}
            
            {statut === 'conforme' && (
              <button
                onClick={() => handleResetItem(item.id)}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                title="Réinitialiser"
              >
                <RefreshCw size={14} />
                {t('common.annuler')}
              </button>
            )}
            
            {statut === 'non_conforme' && (
              <>
                <button
                  onClick={() => handleOpenDefautForm(item)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  title={t('checklist.signaler_correction')}
                >
                  <Wrench size={14} />
                  {t('checklist.corriger')}
                </button>
                <button
                  onClick={() => handleResetItem(item.id)}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {t('common.annuler')}
                </button>
              </>
            )}
            
            {statut === 'corrige' && (
              <button
                onClick={() => handleResetItem(item.id)}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('checklist.chargement')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/coulees')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                {t('checklist.retour')}
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="text-blue-600" />
                  {t('checklist.titre')}
                </h1>
                <p className="text-sm text-gray-600">
                  Coulée N°{couleeInfo?.numero_coulee} - Bobine: {couleeInfo?.numero_bobine}
                </p>
              </div>
            </div>
            
            {/* Statut global */}
            <div className={`px-4 py-2 rounded-lg ${checklistComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {checklistComplete ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={20} />
                  {t('checklist.validee_titre')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Clock size={20} />
                  {t('checklist.en_cours')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-3xl font-bold text-gray-900">{globalStats.total}</div>
            <div className="text-sm text-gray-600">{t('checklist.points_totaux')}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow border-l-4 border-green-500">
            <div className="text-3xl font-bold text-green-600">{globalStats.conformes}</div>
            <div className="text-sm text-gray-600">{t('checklist.conformes')}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow border-l-4 border-red-500">
            <div className="text-3xl font-bold text-red-600">{globalStats.non_conformes || 0}</div>
            <div className="text-sm text-gray-600">{t('checklist.non_conformes')}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow border-l-4 border-blue-500">
            <div className="text-3xl font-bold text-blue-600">{globalStats.corriges || 0}</div>
            <div className="text-sm text-gray-600">{t('checklist.corriges')}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow border-l-4 border-gray-400">
            <div className="text-3xl font-bold text-gray-600">{globalStats.non_verifies || 0}</div>
            <div className="text-sm text-gray-600">{t('checklist.non_verifies')}</div>
          </div>
        </div>

        {/* Alerte points critiques */}
        {globalStats.critiques_non_valides > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center gap-2">
            <AlertTriangle size={20} />
            <span>
              <strong>{globalStats.critiques_non_valides}</strong> {t('checklist.points_critiques')}
            </span>
          </div>
        )}

        {/* Catégories et items */}
        <div className="space-y-4">
          {categories.map(category => (
            <div key={category.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header catégorie */}
              <div className="flex items-center bg-gray-50">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[category.code] || '📋'}</span>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{category.nom}</h3>
                      <p className="text-sm text-gray-500">{category.items?.length || 0} {t('checklist.points_controle')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Mini stats catégorie */}
                    <div className="flex gap-2 text-sm">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">
                        {category.items?.filter(i => validations[i.id]?.statut === 'conforme').length || 0}
                      </span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                        {category.items?.filter(i => validations[i.id]?.statut === 'non_conforme').length || 0}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                        {category.items?.filter(i => !validations[i.id] || validations[i.id]?.statut === 'non_verifie').length || 0}
                      </span>
                    </div>
                    {expandedCategories[category.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>
                {/* Bouton tout valider la section */}
                {(() => {
                  const hasUnvalidated = category.items?.some(i => !validations[i.id] || validations[i.id]?.statut === 'non_verifie');
                  return hasUnvalidated ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleValidateCategory(category); }}
                      disabled={saving}
                      className="mr-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                      title={`Valider tous les points de ${category.nom}`}
                    >
                      <CheckCheck size={16} />
                      {t('checklist.tout_valider')}
                    </button>
                  ) : (
                    <span className="mr-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg whitespace-nowrap">
                      <CheckCircle2 size={16} />
                      {t('checklist.validee')}
                    </span>
                  );
                })()}
              </div>
              
              {/* Items */}
              {expandedCategories[category.id] && (
                <div className="p-4">
                  {category.items?.map(item => renderItem(item))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bouton validation finale */}
        {!checklistComplete && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleValidationFinale}
              disabled={saving || !globalStats.peut_valider}
              className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg"
            >
              <CheckCircle2 size={24} />
              {t('checklist.valider_checklist')}
            </button>
          </div>
        )}
        
        {checklistComplete && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate('/coulees')}
              className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
            >
              <Play size={24} />
              {t('checklist.retour_coulees')}
            </button>
          </div>
        )}
      </div>

      {/* Modal édition défaut/correction */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="text-orange-600" />
                {validations[editingItem.id]?.statut === 'non_conforme' 
                  ? t('checklist.signaler_correction')
                  : t('checklist.signaler_defaut')
                }
              </h3>
              
              <div className="mb-4 p-3 bg-gray-100 rounded">
                <p className="font-medium">{editingItem.libelle}</p>
                {editingItem.description && (
                  <p className="text-sm text-gray-600">{editingItem.description}</p>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('checklist.defaut_detecte')}
                  </label>
                  <textarea
                    value={formData.defaut_detecte}
                    onChange={(e) => setFormData(prev => ({ ...prev, defaut_detecte: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('checklist.placeholder_defaut')}
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('checklist.action_corrective')} {validations[editingItem.id]?.statut === 'non_conforme' && '*'}
                  </label>
                  <textarea
                    value={formData.action_corrective}
                    onChange={(e) => setFormData(prev => ({ ...prev, action_corrective: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder={t('checklist.placeholder_correction')}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('checklist.commentaire_additionnel')}
                  </label>
                  <textarea
                    value={formData.commentaire}
                    onChange={(e) => setFormData(prev => ({ ...prev, commentaire: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={2}
                    placeholder={t('checklist.placeholder_commentaire')}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('common.annuler')}
                </button>
                
                {validations[editingItem.id]?.statut !== 'non_conforme' && (
                  <button
                    onClick={() => handleSaveDefaut('non_conforme')}
                    disabled={!formData.defaut_detecte || saving}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} />
                    {t('checklist.non_conforme')}
                  </button>
                )}
                
                {validations[editingItem.id]?.statut === 'non_conforme' && (
                  <button
                    onClick={() => handleSaveDefaut('corrige')}
                    disabled={!formData.action_corrective || saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    <Wrench size={18} />
                    {t('checklist.marquer_corrige')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
