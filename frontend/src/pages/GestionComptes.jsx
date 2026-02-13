import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Shield, 
  ShieldOff,
  RefreshCw,
  Phone,
  Mail,
  Building2,
  Award,
  UserCog,
  ChevronDown,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Briefcase,
  HardHat
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';

const DEPARTEMENT_CODES = ['production', 'qualite', 'maintenance', 'logistique', 'direction', 'hse'];

const POSTE_CODES = ['formage', 'soudage', 'controle', 'xray', 'chanfreinage', 'hydraulique', 'polyvalent'];

const EQUIPE_CODES = ['A', 'B', 'C', 'jour'];

const DIRECTION_ROLE_DEFS = [
  { value: 'none', icon: null },
  { value: 'chef_projet', icon: Briefcase },
  { value: 'chef_chantier', icon: HardHat }
];

const QUALIFICATION_CODES = ['OP1', 'OP2', 'OP3', 'TECH', 'CTRLQ', 'SOUD', 'XRAY', 'RESP', 'ING', 'CP', 'CC'];

export default function GestionComptes() {
  const { isAdmin } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm, confirmAction } = useConfirm();
  
  const [comptes, setComptes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterActif, setFilterActif] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  
  const [showModal, setShowModal] = useState(false);
  const [editingCompte, setEditingCompte] = useState(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [compteName, setCompteName] = useState('');
  
  const [stats, setStats] = useState({
    total: 0,
    actifs: 0,
    admins: 0,
    chefs_projet: 0,
    chefs_chantier: 0
  });

  useEffect(() => {
    loadComptes();
    loadStats();
  }, []);

  const loadComptes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/comptes');
      setComptes(response.data);
    } catch (error) {
      console.error('Erreur chargement comptes:', error);
      toast.error(t('common.erreur'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/comptes/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleCreate = () => {
    setEditingCompte(null);
    setShowModal(true);
  };

  const handleEdit = (compte) => {
    setEditingCompte(compte);
    setShowModal(true);
  };

  const handleDelete = async (compte) => {
    const confirmed = await confirm({
      type: 'danger',
      title: t('comptes.desactiver_compte'),
      message: `${t('comptes.confirmer_desactivation')} ${compte.prenom} ${compte.nom} ?`,
      description: t('comptes.desactivation_description'),
      confirmLabel: t('comptes.desactiver'),
      cancelLabel: t('common.annuler')
    });
    if (!confirmed) return;
    
    try {
      await api.delete(`/comptes/${compte.id}`);
      toast.success(t('comptes.msg_compte_desactive'));
      loadComptes();
      loadStats();
    } catch (error) {
      toast.error(t('common.erreur'));
    }
  };

  const handlePromote = async (compte) => {
    const confirmed = await confirm({
      type: compte.is_admin ? 'warning' : 'info',
      title: compte.is_admin ? t('comptes.retirer_admin') : t('comptes.promouvoir_admin'),
      message: `${compte.is_admin ? t('comptes.confirmer_retrait') : t('comptes.confirmer_promotion')} ${compte.prenom} ${compte.nom} ?`,
      description: compte.is_admin 
        ? t('comptes.retrait_description')
        : t('comptes.promotion_description'),
      confirmLabel: compte.is_admin ? t('comptes.retirer') : t('comptes.promouvoir'),
      cancelLabel: t('common.annuler')
    });
    if (!confirmed) return;

    try {
      await api.put(`/comptes/${compte.id}/promote`, { is_admin: !compte.is_admin });
      toast.success(compte.is_admin ? t('comptes.msg_admin_retire') : t('comptes.msg_admin_promu'));
      loadComptes();
      loadStats();
    } catch (error) {
      toast.error(t('common.erreur'));
    }
  };

  const handleRegenerateCode = async (compte) => {
    const confirmed = await confirm({
      type: 'warning',
      title: t('comptes.regenerer_code'),
      message: `${t('comptes.confirmer_regeneration')} ${compte.prenom} ${compte.nom} ?`,
      description: t('comptes.regeneration_description'),
      confirmLabel: t('comptes.regenerer'),
      cancelLabel: t('common.annuler')
    });
    if (!confirmed) return;
    
    try {
      const response = await api.put(`/comptes/${compte.id}/regenerate-code`);
      setGeneratedCode(response.data.nouveauCode);
      setCompteName(`${compte.prenom} ${compte.nom}`);
      setShowCodeModal(true);
      loadComptes();
    } catch (error) {
      toast.error(t('common.erreur'));
    }
  };

  const handleActivate = async (compte) => {
    try {
      await api.put(`/comptes/${compte.id}/activate`);
      toast.success(t('comptes.msg_compte_reactive'));
      loadComptes();
      loadStats();
    } catch (error) {
      toast.error(t('common.erreur'));
    }
  };

  const handleSaveCompte = async (data) => {
    try {
      if (editingCompte) {
        await api.put(`/comptes/${editingCompte.id}`, data);
        toast.success(t('comptes.msg_compte_modifie'));
      } else {
        const response = await api.post('/comptes', data);
        setGeneratedCode(response.data.codeConnexion);
        setCompteName(`${data.prenom} ${data.nom}`);
        setShowCodeModal(true);
        toast.success(t('comptes.msg_compte_cree'));
      }
      setShowModal(false);
      loadComptes();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.error || t('common.erreur'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(t('comptes.msg_code_copie'));
  };

  // Filtrage des comptes
  const filteredComptes = comptes.filter(c => {
    const matchSearch = !searchTerm || 
      c.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.includes(searchTerm);
    
    const matchDept = !filterDept || c.departement === filterDept;
    const matchActif = filterActif === 'all' || 
      (filterActif === 'actif' && c.actif) ||
      (filterActif === 'inactif' && !c.actif);
    const matchDirection = filterDirection === 'all' || c.direction_role === filterDirection;
    
    return matchSearch && matchDept && matchActif && matchDirection;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-7 h-7 text-primary-600" />
            {t('comptes.titre')}
          </h1>
          <p className="text-gray-500 mt-1">{t('comptes.sous_titre')}</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={handleCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('comptes.nouveau_compte')}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label={t('comptes.total')} value={stats.total} icon={Users} color="primary" />
        <StatCard label={t('comptes.actifs')} value={stats.actifs} icon={Check} color="success" />
        <StatCard label={t('comptes.admins')} value={stats.admins} icon={Shield} color="accent" />
        <StatCard label={t('comptes.chefs_projet')} value={stats.chefs_projet} icon={Briefcase} color="warning" />
        <StatCard label={t('comptes.chefs_chantier')} value={stats.chefs_chantier} icon={HardHat} color="danger" />
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('comptes.rechercher')}
              className="input-field pl-10"
            />
          </div>

          {/* Filtre département */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="input-field w-full md:w-48"
          >
            <option value="">{t('comptes.tous_departements')}</option>
            {DEPARTEMENT_CODES.map(code => (
              <option key={code} value={code}>{t(`dept.${code}`)}</option>
            ))}
          </select>

          {/* Filtre statut */}
          <select
            value={filterActif}
            onChange={(e) => setFilterActif(e.target.value)}
            className="input-field w-full md:w-36"
          >
            <option value="all">{t('comptes.tous')}</option>
            <option value="actif">{t('comptes.actifs')}</option>
            <option value="inactif">{t('comptes.inactifs')}</option>
          </select>

          {/* Filtre direction */}
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="input-field w-full md:w-44"
          >
            <option value="all">{t('comptes.tous_roles')}</option>
            {DIRECTION_ROLE_DEFS.map(r => (
              <option key={r.value} value={r.value}>{t(`comptes.direction_${r.value}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste des comptes */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredComptes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('comptes.aucun_operateur')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('comptes.utilisateur')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('comptes.code_operateur')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{t('comptes.contact')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{t('comptes.departement')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden xl:table-cell">{t('comptes.role_direction')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('comptes.statut')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('comptes.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredComptes.map(compte => (
                  <CompteRow 
                    key={compte.id} 
                    compte={compte}
                    isAdmin={isAdmin}
                    onEdit={() => handleEdit(compte)}
                    onDelete={() => handleDelete(compte)}
                    onPromote={() => handlePromote(compte)}
                    onRegenerate={() => handleRegenerateCode(compte)}
                    onActivate={() => handleActivate(compte)}
                    onCopy={() => copyToClipboard(compte.code)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <CompteModal
          compte={editingCompte}
          onClose={() => setShowModal(false)}
          onSave={handleSaveCompte}
        />
      )}

      {/* Modal affichage code */}
      {showCodeModal && (
        <CodeModal
          code={generatedCode}
          name={compteName}
          onClose={() => setShowCodeModal(false)}
          onCopy={() => copyToClipboard(generatedCode)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    accent: 'bg-accent-50 text-accent-600'
  };

  return (
    <div className="card flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function CompteRow({ compte, isAdmin, onEdit, onDelete, onPromote, onRegenerate, onActivate, onCopy }) {
  const { t } = useTranslation();
  const [showCode, setShowCode] = useState(false);
  
  const directionRole = DIRECTION_ROLE_DEFS.find(r => r.value === compte.direction_role);
  const DirectionIcon = directionRole?.icon;

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${!compte.actif ? 'opacity-60' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${compte.is_admin ? 'bg-accent-100 text-accent-600' : 'bg-primary-100 text-primary-600'}`}>
            {compte.is_admin ? <Shield className="w-5 h-5" /> : <span className="font-semibold">{compte.prenom[0]}{compte.nom[0]}</span>}
          </div>
          <div>
            <p className="font-medium text-gray-900">{compte.prenom} {compte.nom}</p>
            <p className="text-sm text-gray-500">{compte.matricule}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
            {showCode ? compte.code : '••••••'}
          </code>
          <button 
            onClick={() => setShowCode(!showCode)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title={showCode ? t('comptes.masquer_code') : t('comptes.afficher_code')}
          >
            {showCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onRegenerate}
            className="p-1 rounded hover:bg-primary-50 text-gray-400 hover:text-primary-600 transition-colors"
            title={t('comptes.regenerer_code')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onCopy}
            className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
            title={t('comptes.copier_code')}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <div className="space-y-1">
          {compte.email && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]">{compte.email}</span>
            </div>
          )}
          {compte.telephone && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Phone className="w-3.5 h-3.5" />
              {compte.telephone}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm capitalize">{compte.departement || '-'}</span>
        </div>
        {compte.qualification && (
          <div className="flex items-center gap-1.5 mt-1">
            <Award className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">{compte.qualification}</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        {directionRole && directionRole.value !== 'none' ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-warning-50 text-warning-700">
            {DirectionIcon && <DirectionIcon className="w-3.5 h-3.5" />}
            {t(`comptes.direction_${directionRole.value}`)}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          compte.actif ? 'bg-success-50 text-success-600' : 'bg-gray-100 text-gray-500'
        }`}>
          {compte.actif ? t('comptes.actif') : t('comptes.inactif')}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {isAdmin && (
            <>
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                title={t('comptes.modifier')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onPromote}
                className={`p-2 rounded-lg transition-colors ${
                  compte.is_admin 
                    ? 'hover:bg-warning-50 text-warning-600' 
                    : 'hover:bg-accent-50 text-accent-600'
                }`}
                title={compte.is_admin ? t('comptes.revoquer_admin') : t('comptes.promouvoir_admin')}
              >
                {compte.is_admin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>
              {compte.actif ? (
                <button
                  onClick={onDelete}
                  className="p-2 rounded-lg hover:bg-danger-50 text-danger-600 transition-colors"
                  title={t('comptes.desactiver')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onActivate}
                  className="p-2 rounded-lg hover:bg-success-50 text-success-600 transition-colors"
                  title={t('comptes.reactiver')}
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function CompteModal({ compte, onClose, onSave }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    nom: compte?.nom || '',
    prenom: compte?.prenom || '',
    email: compte?.email || '',
    telephone: compte?.telephone || '',
    departement: compte?.departement || 'production',
    qualification: compte?.qualification || '',
    poste: compte?.poste || 'polyvalent',
    equipe: compte?.equipe || 'jour',
    direction_role: compte?.direction_role || 'none',
    is_admin: compte?.is_admin || false,
    actif: compte?.actif !== undefined ? compte.actif : true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {compte ? t('comptes.modifier_compte') : t('comptes.nouveau_compte')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informations personnelles */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('comptes.infos_personnelles')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.prenom')} *</label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => setFormData({...formData, prenom: e.target.value})}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.nom')} *</label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.telephone')}</label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({...formData, telephone: e.target.value})}
                  className="input-field"
                  placeholder="+213 xxx xxx xxx"
                />
              </div>
            </div>
          </div>

          {/* Département et qualification */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('comptes.dept_et_qualif')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.departement')}</label>
                <select
                  value={formData.departement}
                  onChange={(e) => setFormData({...formData, departement: e.target.value})}
                  className="input-field"
                >
                  {DEPARTEMENT_CODES.map(code => (
                    <option key={code} value={code}>{t(`dept.${code}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.qualification')}</label>
                <select
                  value={formData.qualification}
                  onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                  className="input-field"
                >
                  <option value="">{t('comptes.selectionner')}</option>
                  {QUALIFICATION_CODES.map(code => (
                    <option key={code} value={code}>{t(`qualif.${code}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.poste')}</label>
                <select
                  value={formData.poste}
                  onChange={(e) => setFormData({...formData, poste: e.target.value})}
                  className="input-field"
                >
                  {POSTE_CODES.map(code => (
                    <option key={code} value={code}>{t(`poste.${code}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.equipe')}</label>
                <select
                  value={formData.equipe}
                  onChange={(e) => setFormData({...formData, equipe: e.target.value})}
                  className="input-field"
                >
                  {EQUIPE_CODES.map(code => (
                    <option key={code} value={code}>{t(`equipe.${code}`)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rôles et permissions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t('comptes.roles_permissions')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('comptes.role_direction')}</label>
                <select
                  value={formData.direction_role}
                  onChange={(e) => setFormData({...formData, direction_role: e.target.value})}
                  className="input-field"
                >
                  {DIRECTION_ROLE_DEFS.map(r => (
                    <option key={r.value} value={r.value}>{t(`comptes.direction_${r.value}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({...formData, is_admin: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{t('comptes.admin')}</span>
                </label>
                {compte && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.actif}
                      onChange={(e) => setFormData({...formData, actif: e.target.checked})}
                      className="w-4 h-4 rounded border-gray-300 text-success-600 focus:ring-success-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('comptes.compte_actif')}</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              {t('common.annuler')}
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  {t('common.enregistrement')}...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {compte ? t('common.enregistrer') : t('comptes.creer_compte')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CodeModal({ code, name, onClose, onCopy }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-slideUp">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
            <Check className="w-8 h-8 text-success-600" />
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('comptes.code_genere')}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('comptes.code_pour')} <strong>{name}</strong>
          </p>
          
          <div className="bg-gray-100 rounded-xl p-4 mb-6">
            <p className="text-4xl font-mono font-bold text-primary-600 tracking-widest">
              {code}
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-3">
            <button onClick={onCopy} className="btn-secondary flex items-center gap-2">
              <Copy className="w-4 h-4" />
              {t('comptes.copier')}
            </button>
            <button onClick={onClose} className="btn-primary">
              {t('common.fermer')}
            </button>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            {t('comptes.communiquer_code')}
          </p>
        </div>
      </div>
    </div>
  );
}
