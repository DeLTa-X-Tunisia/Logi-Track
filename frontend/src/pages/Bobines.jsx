import { useState, useEffect, useRef } from 'react';
import { Plus, Search, Package, Trash2, Edit2, BarChart3, Scale, Layers, Calendar, Camera, Upload, X, Image, Eye, FileDown } from 'lucide-react';
import { bobinesApi, steelGradesApi, fournisseursApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/I18nContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3002`;

export default function Bobines() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const { confirm } = useConfirm();
  const fileInputRef = useRef(null);
  const [bobines, setBobines] = useState([]);
  const [steelGrades, setSteelGrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBobine, setEditingBobine] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewPhotos, setPreviewPhotos] = useState([]); // Pour les nouvelles photos à uploader
  const [viewingBobine, setViewingBobine] = useState(null); // Pour le modal de visualisation
  const [viewPhotos, setViewPhotos] = useState([]); // Photos pour le modal de visualisation
  const [fournisseurs, setFournisseurs] = useState([]); // Liste des fournisseurs
  const [showFournisseurModal, setShowFournisseurModal] = useState(false); // Modal ajout fournisseur
  const [newFournisseurNom, setNewFournisseurNom] = useState(''); // Nom du nouveau fournisseur

  const [formData, setFormData] = useState({
    numero: '',
    steel_grade_id: '',
    norme: 'API 5L',
    epaisseur: '',
    largeur: '',
    poids: '',
    fournisseur: '',
    date_reception: '',
    notes: ''
  });

  const normes = ['API 5L', 'API 5CT', 'ASTM A53', 'EN 10219', 'ISO 3183'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [bobinesRes, gradesRes, statsRes] = await Promise.all([
        bobinesApi.getAll(),
        steelGradesApi.getAll({ actif: true }),
        bobinesApi.getStats()
      ]);
      setBobines(bobinesRes.data);
      setSteelGrades(gradesRes.data);
      setStats(statsRes.data);
      // Charger les fournisseurs
      try {
        const fournisseursRes = await fournisseursApi.getAll();
        setFournisseurs(fournisseursRes.data);
      } catch (e) {
        console.error('Erreur chargement fournisseurs:', e);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error(t('common.erreur_chargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let bobineId = editingBobine?.id;
      
      if (editingBobine) {
        await bobinesApi.update(editingBobine.id, formData);
        // Upload des nouvelles photos si présentes
        if (previewPhotos.length > 0) {
          await uploadPhotos(editingBobine.id);
        }
        toast.success(t('bobines.msg_modifiee'));
      } else {
        const res = await bobinesApi.create(formData);
        bobineId = res.data.id;
        // Upload des photos pour la nouvelle bobine
        if (previewPhotos.length > 0 && bobineId) {
          await uploadPhotos(bobineId);
        }
        toast.success(t('bobines.msg_creee'));
      }
      setShowModal(false);
      setEditingBobine(null);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('common.erreur_sauvegarde'));
    }
  };

  const handleEdit = (bobine) => {
    setEditingBobine(bobine);
    setFormData({
      numero: bobine.numero || '',
      steel_grade_id: bobine.steel_grade_id || '',
      norme: bobine.norme || 'API 5L',
      epaisseur: bobine.epaisseur || '',
      largeur: bobine.largeur || '',
      poids: bobine.poids || '',
      fournisseur: bobine.fournisseur || '',
      date_reception: bobine.date_reception?.split('T')[0] || '',
      notes: bobine.notes || ''
    });
    loadPhotos(bobine.id);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await bobinesApi.delete(confirmDelete.id);
      toast.success(t('bobines.msg_supprimee'));
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || t('common.erreur_suppression'));
    }
  };

  // Voir les détails d'une bobine
  const handleView = async (bobine) => {
    try {
      const res = await bobinesApi.getById(bobine.id);
      setViewingBobine(res.data);
      // Charger les photos
      const photosRes = await bobinesApi.getPhotos(bobine.id);
      setViewPhotos(photosRes.data);
    } catch (error) {
      toast.error(t('common.erreur_chargement'));
    }
  };

  // Télécharger le rapport PDF
  const downloadPdf = async (bobineId, numero) => {
    try {
      const token = localStorage.getItem('logitrack_token');
      const response = await fetch(`${API_URL}/api/bobines/${bobineId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Erreur téléchargement');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bobine_${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t('bobines.msg_pdf'));
    } catch (error) {
      toast.error(t('common.erreur_telechargement'));
    }
  };

  const resetForm = () => {
    setFormData({
      numero: '',
      steel_grade_id: '',
      norme: 'API 5L',
      epaisseur: '',
      largeur: '',
      poids: '',
      fournisseur: '',
      date_reception: '',
      notes: ''
    });
    setPhotos([]);
    setPreviewPhotos([]);
  };

  // ============================================
  // GESTION DES PHOTOS
  // ============================================

  const loadPhotos = async (bobineId) => {
    try {
      const res = await bobinesApi.getPhotos(bobineId);
      setPhotos(res.data);
    } catch (error) {
      console.error('Erreur chargement photos:', error);
      setPhotos([]);
    }
  };

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    const totalPhotos = photos.length + previewPhotos.length + files.length;
    
    if (totalPhotos > 5) {
      toast.error(`Maximum 5 photos. Vous avez déjà ${photos.length + previewPhotos.length} photo(s).`);
      return;
    }

    // Créer les previews
    const newPreviews = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setPreviewPhotos(prev => [...prev, ...newPreviews]);
  };

  const removePreviewPhoto = (index) => {
    setPreviewPhotos(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const uploadPhotos = async (bobineId) => {
    if (previewPhotos.length === 0) return;
    
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      previewPhotos.forEach(p => formDataUpload.append('photos', p.file));
      
      await bobinesApi.uploadPhotos(bobineId, formDataUpload);
      toast.success(`${previewPhotos.length} photo(s) uploadée(s)`);
      
      // Nettoyer les previews
      previewPhotos.forEach(p => URL.revokeObjectURL(p.preview));
      setPreviewPhotos([]);
      
      // Recharger les photos
      await loadPhotos(bobineId);
    } catch (error) {
      toast.error(error.response?.data?.error || t('common.erreur_upload'));
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!editingBobine) return;
    try {
      await bobinesApi.deletePhoto(editingBobine.id, photoId);
      toast.success(t('bobines.msg_photo_supprimee'));
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (error) {
      toast.error(t('common.erreur_suppression'));
    }
  };

  const filteredBobines = bobines.filter(b => {
    const matchesSearch = 
      (b.numero || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatut = !filterStatut || b.statut === filterStatut;
    const matchesGrade = !filterGrade || b.steel_grade_id === parseInt(filterGrade);
    return matchesSearch && matchesStatut && matchesGrade;
  });

  const getStatusBadge = (statut) => {
    const badges = {
      'en_stock': { class: 'bg-green-100 text-green-800', label: t('bobines.disponible') },
      'en_cours': { class: 'bg-blue-100 text-blue-800', label: t('bobines.en_cours') },
      'epuisee': { class: 'bg-gray-100 text-gray-600', label: t('bobines.epuisee') }
    };
    return badges[statut] || { class: 'bg-gray-100 text-gray-800', label: statut || t('bobines.disponible') };
  };

  const formatPoids = (poids) => {
    if (!poids) return '-';
    return new Intl.NumberFormat('fr-FR').format(poids) + ' kg';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('bobines.titre')}</h1>
          <p className="text-gray-500">{t('bobines.sous_titre')}</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEditingBobine(null); setShowModal(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {t('bobines.nouvelle_bobine')}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary-100">
              <Package className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('bobines.total')}</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100">
              <Layers className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('bobines.disponible')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.en_stock || 0}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('bobines.en_production')}</p>
              <p className="text-2xl font-bold text-blue-600">{stats.en_cours || 0}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gray-100">
              <Scale className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('bobines.poids_total')}</p>
              <p className="text-2xl font-bold text-gray-600">
                {stats.poids_total ? `${(stats.poids_total / 1000).toFixed(1)} t` : '0 t'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('bobines.rechercher')}
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input w-full md:w-48"
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
          >
            <option value="">{t('bobines.tous_statuts')}</option>
            <option value="en_stock">{t('bobines.disponible')}</option>
            <option value="en_cours">{t('bobines.en_cours')}</option>
            <option value="epuisee">{t('bobines.epuisee')}</option>
          </select>
          <select
            className="input w-full md:w-48"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
          >
            <option value="">{t('bobines.tous_grades')}</option>
            {steelGrades.map(g => (
              <option key={g.id} value={g.id}>{g.code}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.code_bobine')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.grade')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.norme')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.epaisseur')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.poids')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.tubes')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.statut')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('bobines.cree_par')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredBobines.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    {t('bobines.aucune_trouvee')}
                  </td>
                </tr>
              ) : (
                filteredBobines.map(bobine => (
                  <tr key={bobine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-primary-600">{bobine.numero}</td>
                    <td className="px-6 py-4">
                      {bobine.steel_grade_code ? (
                        <span className="font-medium text-gray-900">{bobine.steel_grade_code}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{bobine.norme || bobine.norme_display || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{bobine.epaisseur} mm</td>
                    <td className="px-6 py-4 text-gray-600">{formatPoids(bobine.poids)}</td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{bobine.nombre_tubes || 0}</span>
                      {bobine.tubes_termines > 0 && (
                        <span className="text-success-600 ml-1">({bobine.tubes_termines} ✓)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(bobine.statut).class}`}>
                        {getStatusBadge(bobine.statut).label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {bobine.createur_prenom && bobine.createur_nom 
                        ? `${bobine.createur_prenom} ${bobine.createur_nom.charAt(0)}.`
                        : '-'
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleView(bobine)}
                          className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110"
                          title={t('bobines.details')}
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => downloadPdf(bobine.id, bobine.numero)}
                          className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-100 rounded-lg transition-all duration-200 hover:scale-110"
                          title={t('bobines.telecharger_pdf')}
                        >
                          <FileDown className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleEdit(bobine)}
                          className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all duration-200 hover:scale-110"
                          title={t('common.modifier')}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setConfirmDelete(bobine)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                          title={t('common.supprimer')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingBobine ? t('bobines.modifier_bobine') : t('bobines.nouvelle_bobine')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('bobines.operateur')}: {user?.prenom} {user?.nom}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.code_bobine')} *</label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('bobines.placeholder_code')}
                  value={formData.numero}
                  onChange={(e) => setFormData({...formData, numero: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.norme')}</label>
                  <select
                    className="input"
                    value={formData.norme}
                    onChange={(e) => setFormData({...formData, norme: e.target.value})}
                  >
                    {normes.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.grade_nuance')}</label>
                  <select
                    className="input"
                    value={formData.steel_grade_id}
                    onChange={(e) => setFormData({...formData, steel_grade_id: e.target.value})}
                  >
                    <option value="">{t('bobines.selectionner')}</option>
                    {Object.entries(
                      steelGrades.reduce((acc, grade) => {
                        const norme = grade.norme || 'Autre';
                        if (!acc[norme]) acc[norme] = [];
                        acc[norme].push(grade);
                        return acc;
                      }, {})
                    ).map(([norme, grades]) => (
                      <optgroup key={norme} label={norme}>
                        {grades.map(grade => (
                          <option key={grade.id} value={grade.id}>
                            {grade.code} - {grade.nom}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.epaisseur_mm')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Ex: 12"
                    value={formData.epaisseur}
                    onChange={(e) => setFormData({...formData, epaisseur: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.largeur_mm')}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Ex: 1500"
                    value={formData.largeur}
                    onChange={(e) => setFormData({...formData, largeur: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.poids_kg')}</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    placeholder="Ex: 31600"
                    value={formData.poids}
                    onChange={(e) => setFormData({...formData, poids: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.fournisseur')}</label>
                  <div className="flex gap-2">
                    <select
                      className="input flex-1"
                      value={formData.fournisseur}
                      onChange={(e) => setFormData({...formData, fournisseur: e.target.value})}
                    >
                      <option value="">{t('bobines.placeholder_fournisseur')}</option>
                      {fournisseurs.map(f => (
                        <option key={f.id} value={f.nom}>{f.nom}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowFournisseurModal(true)}
                      className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                      title={t('bobines.ajouter_fournisseur', 'Ajouter un fournisseur')}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.date_reception')}</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.date_reception}
                    onChange={(e) => setFormData({...formData, date_reception: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('bobines.notes')}</label>
                <textarea
                  className="input"
                  rows="3"
                  placeholder={t('bobines.placeholder_notes')}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              {/* Section Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Camera className="w-4 h-4 inline mr-1" />
                  {t('bobines.photos')} ({photos.length + previewPhotos.length}/5)
                </label>
                
                {/* Photos existantes */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {photos.map(photo => (
                      <div key={photo.id} className="relative group">
                        <img
                          src={`${API_URL}${photo.path}`}
                          alt={photo.original_name}
                          className="w-full h-20 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => deletePhoto(photo.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Previews des nouvelles photos */}
                {previewPhotos.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {previewPhotos.map((preview, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={preview.preview}
                          alt={preview.name}
                          className="w-full h-20 object-cover rounded-lg border-2 border-primary-300"
                        />
                        <button
                          type="button"
                          onClick={() => removePreviewPhoto(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-danger-500 text-white rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-0 left-0 right-0 bg-primary-500/80 text-white text-xs text-center py-0.5 rounded-b-lg">
                          {t('bobines.nouveau_label')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton d'ajout */}
                {photos.length + previewPhotos.length < 5 && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          {t('bobines.upload_en_cours')}
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          {t('bobines.ajouter_photos')} (max {5 - photos.length - previewPhotos.length})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => { setShowModal(false); setEditingBobine(null); }}
                  className="btn-secondary flex-1"
                >
                  {t('common.annuler')}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingBobine ? t('common.modifier') : t('bobines.creer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-fadeIn">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-danger-100 mx-auto mb-4 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-danger-600" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-900 mb-2">
                {t('bobines.supprimer_titre')} {confirmDelete.numero} ?
              </h3>
              <p className="text-center text-gray-500 mb-6">
                {t('bobines.supprimer_confirm')}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="btn-secondary flex-1"
                >
                  {t('common.annuler')}
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors"
                >
                  {t('common.supprimer')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Voir les détails */}
      {viewingBobine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {t('bobines.details')}
                </h2>
                <p className="text-primary-600 font-semibold">{viewingBobine.numero}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadPdf(viewingBobine.id, viewingBobine.numero)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  {t('bobines.telecharger_pdf')}
                </button>
                <button
                  onClick={() => setViewingBobine(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Informations générales */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('bobines.info_generales')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.code_bobine')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.numero}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.norme')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.norme || 'API 5L'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.grade_nuance')}</p>
                    <p className="font-semibold text-gray-900">
                      {viewingBobine.steel_grade_code 
                        ? `${viewingBobine.steel_grade_code} - ${viewingBobine.steel_grade_nom || ''}`
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('common.statut')}</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(viewingBobine.statut).class}`}>
                      {getStatusBadge(viewingBobine.statut).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Caractéristiques techniques */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  {t('bobines.caract_techniques')}
                </h3>
                <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.epaisseur')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.epaisseur ? `${viewingBobine.epaisseur} mm` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.largeur')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.largeur ? `${viewingBobine.largeur} mm` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.poids')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.poids ? formatPoids(viewingBobine.poids) : '-'}</p>
                  </div>
                </div>
              </div>

              {/* Fournisseur et réception */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  {t('bobines.fournisseur_reception')}
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.fournisseur')}</p>
                    <p className="font-semibold text-gray-900">{viewingBobine.fournisseur || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.date_reception')}</p>
                    <p className="font-semibold text-gray-900">
                      {viewingBobine.date_reception 
                        ? new Date(viewingBobine.date_reception).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingBobine.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Notes</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{viewingBobine.notes}</p>
                  </div>
                </div>
              )}

              {/* Photos */}
              {viewPhotos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Photos ({viewPhotos.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {viewPhotos.map(photo => (
                      <a 
                        key={photo.id} 
                        href={`${API_URL}${photo.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={`${API_URL}${photo.path}`}
                          alt={photo.original_name}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:border-primary-400 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Traçabilité */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {t('bobines.tracabilite')}
                </h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.cree_par')}</p>
                    <p className="font-semibold text-gray-900">
                      {viewingBobine.createur_prenom && viewingBobine.createur_nom 
                        ? `${viewingBobine.createur_prenom} ${viewingBobine.createur_nom}`
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('bobines.date_creation')}</p>
                    <p className="font-semibold text-gray-900">
                      {viewingBobine.created_at 
                        ? new Date(viewingBobine.created_at).toLocaleDateString('fr-FR')
                        : '-'
                      }
                    </p>
                  </div>
                  {viewingBobine.modificateur_prenom && viewingBobine.modificateur_nom && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500">{t('bobines.modifie_par')}</p>
                        <p className="font-semibold text-gray-900">
                          {`${viewingBobine.modificateur_prenom} ${viewingBobine.modificateur_nom}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('bobines.derniere_modif')}</p>
                        <p className="font-semibold text-gray-900">
                          {viewingBobine.updated_at 
                            ? new Date(viewingBobine.updated_at).toLocaleDateString('fr-FR')
                            : '-'
                          }
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => setViewingBobine(null)}
                className="btn-secondary w-full"
              >
                {t('common.fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gérer les fournisseurs */}
      {showFournisseurModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-fadeIn max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {t('bobines.gerer_fournisseurs', 'Gérer les fournisseurs')}
              </h3>
              <button
                onClick={() => { setShowFournisseurModal(false); setNewFournisseurNom(''); }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulaire d'ajout */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newFournisseurNom.trim()) return;
              try {
                const res = await fournisseursApi.create({ nom: newFournisseurNom.trim() });
                const newFournisseur = res.data;
                const fournisseursRes = await fournisseursApi.getAll();
                setFournisseurs(fournisseursRes.data);
                setFormData(prev => ({ ...prev, fournisseur: newFournisseur.nom }));
                setNewFournisseurNom('');
                toast.success(t('bobines.fournisseur_ajoute', 'Fournisseur ajouté'));
              } catch (error) {
                toast.error(error.response?.data?.error || t('common.erreur_sauvegarde'));
              }
            }} className="p-4 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('bobines.nom_fournisseur', 'Nom du fournisseur')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder={t('bobines.placeholder_fournisseur')}
                  value={newFournisseurNom}
                  onChange={(e) => setNewFournisseurNom(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="btn-primary px-4">
                  <Plus size={18} />
                </button>
              </div>
            </form>

            {/* Liste des fournisseurs existants */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                {t('bobines.fournisseurs_existants', 'Fournisseurs existants')} ({fournisseurs.length})
              </p>
              {fournisseurs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  {t('bobines.aucun_fournisseur', 'Aucun fournisseur')}
                </p>
              ) : (
                <div className="space-y-1">
                  {fournisseurs.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 group">
                      <span className="text-sm font-medium text-gray-800">{f.nom}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await confirm({
                            type: 'danger',
                            title: t('bobines.suppr_fournisseur_titre', 'Supprimer le fournisseur'),
                            message: `${t('bobines.confirmer_suppr_fournisseur', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ?')}`,
                            description: `"${f.nom}" — ${t('bobines.suppr_fournisseur_desc', 'Cette action est définitive et ne peut pas être annulée.')}`,
                            confirmLabel: t('common.supprimer'),
                            cancelLabel: t('common.annuler'),
                          });
                          if (!confirmed) return;
                          try {
                            await fournisseursApi.delete(f.id);
                            const fournisseursRes = await fournisseursApi.getAll();
                            setFournisseurs(fournisseursRes.data);
                            // Si le fournisseur supprimé était sélectionné, le désélectionner
                            if (formData.fournisseur === f.nom) {
                              setFormData(prev => ({ ...prev, fournisseur: '' }));
                            }
                            toast.success(t('bobines.fournisseur_supprime', 'Fournisseur supprimé'));
                          } catch (error) {
                            toast.error(error.response?.data?.error || t('common.erreur_suppression'));
                          }
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title={t('common.supprimer')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-xl">
              <button
                type="button"
                onClick={() => { setShowFournisseurModal(false); setNewFournisseurNom(''); }}
                className="btn-secondary w-full"
              >
                {t('common.fermer')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
