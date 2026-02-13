import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../services/api';
import {
  Building2,
  Upload,
  Trash2,
  Save,
  Image,
  MapPin,
  Hash,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3002`;

export default function ParametresProjet() {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parametres, setParametres] = useState({
    client_nom: '',
    client_adresse: '',
    projet_nom: '',
    projet_adresse: '',
    projet_code: '',
    logo_path: null,
    client_logo_path: null
  });

  const logoInputRef = useRef(null);
  const clientLogoInputRef = useRef(null);

  useEffect(() => {
    fetchParametres();
  }, []);

  const fetchParametres = async () => {
    try {
      const response = await api.get('/projet-parametres');
      if (response.data.parametres) {
        const p = response.data.parametres;
        setParametres({
          client_nom: p.client_nom || '',
          client_adresse: p.client_adresse || '',
          projet_nom: p.projet_nom || '',
          projet_adresse: p.projet_adresse || '',
          projet_code: p.projet_code || '',
          logo_path: p.logo_path || null,
          client_logo_path: p.client_logo_path || null
        });
      }
    } catch (error) {
      console.error('Erreur chargement paramètres:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/projet-parametres', {
        client_nom: parametres.client_nom,
        client_adresse: parametres.client_adresse,
        projet_nom: parametres.projet_nom,
        projet_adresse: parametres.projet_adresse,
        projet_code: parametres.projet_code
      });
      toast.success('Paramètres sauvegardés avec succès');
      window.dispatchEvent(new Event('projet-parametres-updated'));
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file, type) => {
    if (!file) return;

    const formData = new FormData();
    const fieldName = type === 'logo' ? 'logo' : 'client_logo';
    formData.append(fieldName, file);

    try {
      const endpoint = type === 'logo' ? '/projet-parametres/logo' : '/projet-parametres/client-logo';
      const response = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const pathKey = type === 'logo' ? 'logo_path' : 'client_logo_path';
      setParametres(prev => ({ ...prev, [pathKey]: response.data[pathKey] }));
      toast.success(`Logo ${type === 'logo' ? '' : 'client '}uploadé avec succès`);
      window.dispatchEvent(new Event('projet-parametres-updated'));
    } catch (error) {
      console.error('Erreur upload logo:', error);
      toast.error('Erreur lors de l\'upload du logo');
    }
  };

  const handleLogoDelete = async (type) => {
    try {
      const endpoint = type === 'logo' ? '/projet-parametres/logo' : '/projet-parametres/client-logo';
      await api.delete(endpoint);

      const pathKey = type === 'logo' ? 'logo_path' : 'client_logo_path';
      setParametres(prev => ({ ...prev, [pathKey]: null }));
      toast.success('Logo supprimé');
      window.dispatchEvent(new Event('projet-parametres-updated'));
    } catch (error) {
      console.error('Erreur suppression logo:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres du Projet</h1>
            <p className="text-sm text-gray-500">Configuration générale du projet et informations client</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-500/25 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Logos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo Entreprise */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-violet-500" />
            Logo Entreprise
          </h3>
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
              {parametres.logo_path ? (
                <img
                  src={`${API_URL}/${parametres.logo_path}`}
                  alt="Logo entreprise"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center">
                  <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Aucun logo</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e.target.files[0], 'logo')}
              />
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                {parametres.logo_path ? 'Changer' : 'Uploader'}
              </button>
              {parametres.logo_path && (
                <button
                  onClick={() => handleLogoDelete('logo')}
                  className="flex items-center gap-2 px-4 py-2 bg-danger-50 text-danger-600 rounded-lg hover:bg-danger-100 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logo Client */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-500" />
            Logo Client
          </h3>
          <div className="flex flex-col items-center gap-4">
            <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
              {parametres.client_logo_path ? (
                <img
                  src={`${API_URL}/${parametres.client_logo_path}`}
                  alt="Logo client"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center">
                  <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Aucun logo</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={clientLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e.target.files[0], 'client_logo')}
              />
              <button
                onClick={() => clientLogoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                {parametres.client_logo_path ? 'Changer' : 'Uploader'}
              </button>
              {parametres.client_logo_path && (
                <button
                  onClick={() => handleLogoDelete('client_logo')}
                  className="flex items-center gap-2 px-4 py-2 bg-danger-50 text-danger-600 rounded-lg hover:bg-danger-100 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informations Client */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          Informations Client
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom du Client
            </label>
            <input
              type="text"
              value={parametres.client_nom}
              onChange={(e) => setParametres(prev => ({ ...prev, client_nom: e.target.value }))}
              placeholder="ALTUMET"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse du Client
            </label>
            <input
              type="text"
              value={parametres.client_adresse}
              onChange={(e) => setParametres(prev => ({ ...prev, client_adresse: e.target.value }))}
              placeholder="Alger Rouiba"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Informations Projet */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-violet-500" />
          Informations Projet
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nom du Projet
            </label>
            <input
              type="text"
              value={parametres.projet_nom}
              onChange={(e) => setParametres(prev => ({ ...prev, projet_nom: e.target.value }))}
              placeholder="ALTUMET Machine tube Spirale OFF-LINE"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Code du Projet
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={parametres.projet_code}
                onChange={(e) => setParametres(prev => ({ ...prev, projet_code: e.target.value }))}
                placeholder="DP0HX4457"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse du Projet
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <textarea
                value={parametres.projet_adresse}
                onChange={(e) => setParametres(prev => ({ ...prev, projet_adresse: e.target.value }))}
                placeholder="Zone industrielle Rouiba"
                rows={2}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Aperçu Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Aperçu dans le Header
        </h3>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-4">
            {parametres.logo_path && (
              <img
                src={`${API_URL}/${parametres.logo_path}`}
                alt="Logo"
                className="h-10 w-auto object-contain"
              />
            )}
            {parametres.client_logo_path && (
              <>
                {parametres.logo_path && <div className="w-px h-8 bg-gray-300" />}
                <img
                  src={`${API_URL}/${parametres.client_logo_path}`}
                  alt="Logo client"
                  className="h-10 w-auto object-contain"
                />
              </>
            )}
            {(parametres.client_nom || parametres.projet_nom) && (
              <>
                {(parametres.logo_path || parametres.client_logo_path) && <div className="w-px h-8 bg-gray-300" />}
                <div className="flex flex-col">
                  {parametres.client_nom && (
                    <span className="text-sm font-semibold text-gray-800">{parametres.client_nom}</span>
                  )}
                  {parametres.projet_nom && (
                    <span className="text-xs text-gray-500">
                      {parametres.projet_nom}
                      {parametres.projet_code && <span className="ml-1.5 text-primary-600 font-medium">({parametres.projet_code})</span>}
                    </span>
                  )}
                </div>
              </>
            )}
            {!parametres.logo_path && !parametres.client_logo_path && !parametres.client_nom && !parametres.projet_nom && (
              <p className="text-sm text-gray-400 italic">Remplissez les champs ci-dessus pour voir l'aperçu</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
