/**
 * Page Paramètres de Production
 * CRUD complet avec 3 sections: Formage, Tackwelding, Soudure Finale
 * Numérotation PAR-{diamètre}-{seq}
 */

import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Search, Eye, X, Check, Edit3, Copy,
  Settings, Zap, Flame, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Save, ArrowLeft, Circle
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';
import api from '../services/api';

// Options pour les listes déroulantes
const GAZ_OPTIONS = [
  { value: 'CO2', label: 'CO₂' },
  { value: 'Argon_CO2', label: 'Argon / CO₂ Mix' },
  { value: 'Argon_O2', label: 'Argon / O₂ Mix' },
  { value: 'Argon_pur', label: 'Argon pur' },
  { value: 'Autre', label: 'Autre' }
];

const FIL_OPTIONS = ['1.0mm', '1.2mm', '1.6mm', '2.0mm', '2.4mm', '3.2mm', '4.0mm'];
const FLUX_OPTIONS = [
  { value: 'SAW', label: 'SAW (Submerged Arc)' },
  { value: 'FCAW', label: 'FCAW (Flux-Cored)' },
  { value: 'GMAW', label: 'GMAW (Gas Metal)' },
  { value: 'Autre', label: 'Autre' }
];

// Diamètres standards API 5L (pouces → mm)
const DIAMETRES = [
  { pouce: 8, mm: 219.1 }, { pouce: 10, mm: 273.1 }, { pouce: 12, mm: 323.9 },
  { pouce: 14, mm: 355.6 }, { pouce: 16, mm: 406.4 }, { pouce: 18, mm: 457.2 },
  { pouce: 20, mm: 508.0 }, { pouce: 22, mm: 558.8 }, { pouce: 24, mm: 609.6 },
  { pouce: 26, mm: 660.4 }, { pouce: 28, mm: 711.2 }, { pouce: 30, mm: 762.0 },
  { pouce: 32, mm: 812.8 }, { pouce: 34, mm: 863.6 }, { pouce: 36, mm: 914.4 },
  { pouce: 38, mm: 965.2 }, { pouce: 40, mm: 1016.0 }, { pouce: 42, mm: 1066.8 },
  { pouce: 44, mm: 1117.6 }, { pouce: 46, mm: 1168.4 }, { pouce: 48, mm: 1219.2 },
  { pouce: 50, mm: 1270.0 }, { pouce: 52, mm: 1320.8 }, { pouce: 54, mm: 1371.6 },
  { pouce: 56, mm: 1422.4 }, { pouce: 58, mm: 1473.2 }, { pouce: 60, mm: 1524.0 },
  { pouce: 64, mm: 1625.6 }, { pouce: 66, mm: 1676.4 }, { pouce: 68, mm: 1727.2 },
  { pouce: 72, mm: 1828.8 }, { pouce: 76, mm: 1930.4 }, { pouce: 80, mm: 2032.0 },
  { pouce: 82, mm: 2082.8 },
];

const DEFAULT_HEADS = [
  { type: 'ID', numero: 1, actif: true, amperage: 0, voltage: 0, type_fil: '3.2mm' },
  { type: 'ID', numero: 2, actif: true, amperage: 0, voltage: 0, type_fil: '3.2mm' },
  { type: 'ID', numero: 3, actif: false, amperage: 0, voltage: 0, type_fil: '3.2mm' },
  { type: 'OD', numero: 1, actif: true, amperage: 0, voltage: 0, type_fil: '3.2mm' },
  { type: 'OD', numero: 2, actif: true, amperage: 0, voltage: 0, type_fil: '3.2mm' },
];

const EMPTY_FORM = {
  strip_vitesse_m: 0, strip_vitesse_cm: 0,
  milling_edge_gauche: 40, milling_edge_droit: 40,
  pression_rouleaux: '', pression_rouleaux_unite: 'tonnes',
  tack_amperage: 0, tack_voltage: 0,
  tack_vitesse_m: 0, tack_vitesse_cm: 0,
  tack_frequence: '', tack_type_gaz: 'CO2', tack_debit_gaz: '',
  soudure_vitesse_m: 0, soudure_vitesse_cm: 0,
  soudure_type_fil: '1.6mm', soudure_type_flux: 'SAW',
  notes: ''
};

export default function ParametresProduction() {
  const { showToast } = useToast();
  const { confirm, confirmDelete } = useConfirm();

  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [prochainNumero, setProchainNumero] = useState('');

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [heads, setHeads] = useState(JSON.parse(JSON.stringify(DEFAULT_HEADS)));
  const [selectedDiametre, setSelectedDiametre] = useState(null);
  const [showDiametreModal, setShowDiametreModal] = useState(false);

  // Section accordion state
  const [openSections, setOpenSections] = useState({ formage: true, tack: true, soudure: true });

  useEffect(() => { fetchPresets(); }, []);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/parametres');
      setPresets(res.data);
    } catch (e) {
      console.error(e);
      showToast('Erreur chargement paramètres', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProchainNumero = async (diametre) => {
    try {
      const params = diametre ? `?diametre=${diametre}` : '';
      const res = await api.get(`/parametres/prochain-numero${params}`);
      setProchainNumero(res.data.numero);
    } catch (e) { console.error(e); }
  };

  const openNew = () => {
    setSelectedDiametre(null);
    setShowDiametreModal(true);
  };

  const confirmDiametre = async (diametre) => {
    setSelectedDiametre(diametre);
    setShowDiametreModal(false);
    await fetchProchainNumero(diametre);
    setFormData({ ...EMPTY_FORM });
    setHeads(JSON.parse(JSON.stringify(DEFAULT_HEADS)));
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (preset) => {
    setSelectedDiametre(preset.diametre_pouce || null);
    setFormData({
      strip_vitesse_m: preset.strip_vitesse_m || 0,
      strip_vitesse_cm: preset.strip_vitesse_cm || 0,
      milling_edge_gauche: preset.milling_edge_gauche || 0,
      milling_edge_droit: preset.milling_edge_droit || 0,
      pression_rouleaux: preset.pression_rouleaux || '',
      pression_rouleaux_unite: preset.pression_rouleaux_unite || 'tonnes',
      tack_amperage: preset.tack_amperage || 0,
      tack_voltage: preset.tack_voltage || 0,
      tack_vitesse_m: preset.tack_vitesse_m || 0,
      tack_vitesse_cm: preset.tack_vitesse_cm || 0,
      tack_frequence: preset.tack_frequence || '',
      tack_type_gaz: preset.tack_type_gaz || 'CO2',
      tack_debit_gaz: preset.tack_debit_gaz || '',
      soudure_vitesse_m: preset.soudure_vitesse_m || 0,
      soudure_vitesse_cm: preset.soudure_vitesse_cm || 0,
      soudure_type_fil: preset.soudure_type_fil || '1.6mm',
      soudure_type_flux: preset.soudure_type_flux || 'SAW',
      notes: preset.notes || ''
    });
    setHeads(
      preset.heads && preset.heads.length > 0
        ? preset.heads.map(h => ({ ...h, actif: !!h.actif, type_fil: h.type_fil || '3.2mm' }))
        : JSON.parse(JSON.stringify(DEFAULT_HEADS))
    );
    setEditingId(preset.id);
    setProchainNumero(preset.numero);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = { ...formData, heads, numero: prochainNumero, diametre_pouce: selectedDiametre };

      if (editingId) {
        await api.put(`/parametres/${editingId}`, payload);
        showToast('Preset modifié avec succès', 'success');
      } else {
        await api.post('/parametres', payload);
        showToast('Preset créé avec succès', 'success');
      }
      setShowModal(false);
      fetchPresets();
    } catch (e) {
      showToast(e.response?.data?.error || 'Erreur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (preset) => {
    const ok = await confirmDelete(`le preset ${preset.numero}`);
    if (!ok) return;
    try {
      await api.delete(`/parametres/${preset.id}`);
      showToast('Preset supprimé', 'success');
      fetchPresets();
    } catch (e) {
      showToast(e.response?.data?.error || 'Erreur suppression', 'error');
    }
  };

  const handleDuplicate = async (preset) => {
    try {
      await api.post(`/parametres/${preset.id}/dupliquer`);
      showToast(`Preset dupliqué avec succès`, 'success');
      fetchPresets();
    } catch (e) {
      showToast('Erreur duplication', 'error');
    }
  };

  const updateHead = (index, field, value) => {
    const updated = [...heads];
    if (field === 'actif') {
      updated[index].actif = !updated[index].actif;
      if (!updated[index].actif) {
        updated[index].amperage = 0;
        updated[index].voltage = 0;
      }
    } else {
      updated[index][field] = value;
    }
    setHeads(updated);
  };

  const toggleSection = (key) => {
    setOpenSections(p => ({ ...p, [key]: !p[key] }));
  };

  const formatVitesse = (m, cm) => `${m} m – ${String(cm).padStart(2, '0')} cm/min`;
  const formatGaz = (val) => GAZ_OPTIONS.find(g => g.value === val)?.label || val;

  const filtered = presets.filter(p =>
    p.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.diametre_pouce && `${p.diametre_pouce}"`.includes(searchQuery))
  );

  // Grouper par diamètre
  const grouped = {};
  filtered.forEach(p => {
    const key = p.diametre_pouce || 0;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });
  const sortedKeys = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-7 h-7 text-violet-600" />
            Paramètres de Production
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {presets.length} preset{presets.length > 1 ? 's' : ''} configuré{presets.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" /> Nouveau Preset
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher un preset..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
        />
      </div>

      {/* Cards Grid */}
      {loading && presets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun preset trouvé</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedKeys.map(key => {
            const diam = DIAMETRES.find(d => d.pouce === key);
            return (
              <div key={key}>
                {/* Diameter group header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    key === 0 
                      ? 'bg-gray-100 text-gray-600' 
                      : 'bg-violet-100 text-violet-700'
                  }`}>
                    <Circle className="w-3 h-3" />
                    {key === 0 
                      ? 'Sans diamètre' 
                      : `Ø ${key}" (${diam ? diam.mm.toFixed(1) : key * 25.4} mm)`
                    }
                  </div>
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-400">{grouped[key].length} preset{grouped[key].length > 1 ? 's' : ''}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {grouped[key].map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      onView={() => setShowDetail(preset)}
                      onEdit={() => openEdit(preset)}
                      onDelete={() => handleDelete(preset)}
                      onDuplicate={() => handleDuplicate(preset)}
                      formatVitesse={formatVitesse}
                      formatGaz={formatGaz}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Sélection Diamètre */}
      {showDiametreModal && (
        <DiametreModal
          onSelect={confirmDiametre}
          onClose={() => setShowDiametreModal(false)}
        />
      )}

      {/* Modal Création/Edition */}
      {showModal && (
        <PresetModal
          editingId={editingId}
          numero={prochainNumero}
          diametre={selectedDiametre}
          formData={formData}
          setFormData={setFormData}
          heads={heads}
          updateHead={updateHead}
          openSections={openSections}
          toggleSection={toggleSection}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
          loading={loading}
        />
      )}

      {/* Modal Détail */}
      {showDetail && (
        <DetailModal
          preset={showDetail}
          onClose={() => setShowDetail(null)}
          formatVitesse={formatVitesse}
          formatGaz={formatGaz}
        />
      )}
    </div>
  );
}

/* ============================================
 * Composant Carte Preset
 * ============================================ */
function PresetCard({ preset, onView, onEdit, onDelete, onDuplicate, formatVitesse, formatGaz }) {
  const idHeads = (preset.heads || []).filter(h => h.type === 'ID');
  const odHeads = (preset.heads || []).filter(h => h.type === 'OD');
  const activeHeads = (preset.heads || []).filter(h => h.actif).length;
  const totalHeads = (preset.heads || []).length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-violet-50/50 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-lg">{preset.numero}</span>
            {preset.diametre_pouce && (
              <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                Ø {preset.diametre_pouce}"
              </span>
            )}
            {preset.nb_coulees > 0 && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {preset.nb_coulees} coulée{preset.nb_coulees > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg" title="Voir détail">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={onDuplicate} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Dupliquer">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Modifier">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content - Résumé compact */}
      <div className="p-4 space-y-3 text-sm">
        {/* Formage */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span className="text-gray-500 w-20">Strip</span>
          <span className="font-medium text-gray-900">{formatVitesse(preset.strip_vitesse_m, preset.strip_vitesse_cm)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span className="text-gray-500 w-20">Milling</span>
          <span className="font-medium text-gray-900">{preset.milling_edge_gauche}° / {preset.milling_edge_droit}°</span>
        </div>

        {/* Tackwelding */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
          <span className="text-gray-500 w-20">Tack</span>
          <span className="font-medium text-gray-900">{preset.tack_amperage}A / {preset.tack_voltage}V</span>
        </div>

        {/* Soudure */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
          <span className="text-gray-500 w-20">Soudure</span>
          <span className="font-medium text-gray-900">{formatVitesse(preset.soudure_vitesse_m, preset.soudure_vitesse_cm)}</span>
        </div>

        {/* Heads résumé */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-gray-500">Têtes</span>
          <span className="font-medium text-gray-900">{activeHeads}/{totalHeads} actives</span>
          <div className="flex gap-1 ml-auto">
            {[...idHeads, ...odHeads].map((h, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${h.actif ? 'bg-green-500' : 'bg-red-400'}`} 
                    title={`${h.type} Head ${h.numero}: ${h.actif ? `${h.amperage}A/${h.voltage}V` : 'Off'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      {preset.notes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 truncate" title={preset.notes}>{preset.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================
 * Composant VitesseInput (m + cm)
 * ============================================ */
function VitesseInput({ label, mValue, cmValue, onMChange, onCmChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <select
          value={mValue}
          onChange={(e) => onMChange(parseInt(e.target.value))}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
        >
          {Array.from({ length: 9 }, (_, i) => i + 1).map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <span className="text-gray-500 text-sm font-medium">m –</span>
        <select
          value={cmValue}
          onChange={(e) => onCmChange(parseInt(e.target.value))}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
        >
          {Array.from({ length: 100 }, (_, i) => i).map(v => (
            <option key={v} value={v}>{String(v).padStart(2, '0')}</option>
          ))}
        </select>
        <span className="text-gray-500 text-sm">cm/min</span>
      </div>
    </div>
  );
}

/* ============================================
 * Modal Création / Édition
 * ============================================ */
function PresetModal({ editingId, numero, diametre, formData, setFormData, heads, updateHead, openSections, toggleSection, onSubmit, onClose, loading }) {
  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const idHeads = heads.filter(h => h.type === 'ID');
  const odHeads = heads.filter(h => h.type === 'OD');
  const diamInfo = DIAMETRES.find(d => d.pouce === diametre);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-violet-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingId ? 'Modifier' : 'Nouveau'} Preset
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-violet-600 font-mono font-medium">{numero}</p>
              {diametre && (
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                  Ø {diametre}" ({diamInfo ? diamInfo.mm.toFixed(1) : diametre * 25.4} mm)
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-violet-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">

          {/* ===== SECTION 1: FORMAGE ===== */}
          <SectionHeader
            title="Formage"
            icon={<Settings className="w-5 h-5 text-blue-600" />}
            color="blue"
            open={openSections.formage}
            onToggle={() => toggleSection('formage')}
          />
          {openSections.formage && (
            <div className="pl-4 border-l-2 border-blue-200 space-y-4">
              <VitesseInput
                label="Vitesse de strip"
                mValue={formData.strip_vitesse_m}
                cmValue={formData.strip_vitesse_cm}
                onMChange={(v) => update('strip_vitesse_m', v)}
                onCmChange={(v) => update('strip_vitesse_cm', v)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Milling Edge Gauche (°)</label>
                  <input
                    type="number" step="0.1" min="0" max="90"
                    value={formData.milling_edge_gauche}
                    onChange={(e) => update('milling_edge_gauche', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Milling Edge Droit (°)</label>
                  <input
                    type="number" step="0.1" min="0" max="90"
                    value={formData.milling_edge_droit}
                    onChange={(e) => update('milling_edge_droit', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pression Rouleaux <span className="text-gray-400">(optionnel)</span></label>
                  <input
                    type="number" step="0.01" min="0"
                    value={formData.pression_rouleaux}
                    onChange={(e) => update('pression_rouleaux', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                  <select
                    value={formData.pression_rouleaux_unite}
                    onChange={(e) => update('pression_rouleaux_unite', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    <option value="tonnes">Tonnes</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ===== SECTION 2: TACKWELDING ===== */}
          <SectionHeader
            title="Tackwelding (Machine Offline)"
            icon={<Zap className="w-5 h-5 text-amber-600" />}
            color="amber"
            open={openSections.tack}
            onToggle={() => toggleSection('tack')}
          />
          {openSections.tack && (
            <div className="pl-4 border-l-2 border-amber-200 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ampérage (A)</label>
                  <input
                    type="number" step="1" min="0"
                    value={formData.tack_amperage}
                    onChange={(e) => update('tack_amperage', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voltage (V)</label>
                  <input
                    type="number" step="0.1" min="0"
                    value={formData.tack_voltage}
                    onChange={(e) => update('tack_voltage', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <VitesseInput
                label="Vitesse de soudure"
                mValue={formData.tack_vitesse_m}
                cmValue={formData.tack_vitesse_cm}
                onMChange={(v) => update('tack_vitesse_m', v)}
                onCmChange={(v) => update('tack_vitesse_cm', v)}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fréquence HF (Hz) <span className="text-gray-400">(optionnel)</span></label>
                  <input
                    type="number" step="0.1" min="0"
                    value={formData.tack_frequence}
                    onChange={(e) => update('tack_frequence', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                    placeholder="—"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de gaz</label>
                  <select
                    value={formData.tack_type_gaz}
                    onChange={(e) => update('tack_type_gaz', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    {GAZ_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Débit de gaz (L/min) <span className="text-gray-400">(optionnel)</span></label>
                <input
                  type="number" step="0.1" min="0"
                  value={formData.tack_debit_gaz}
                  onChange={(e) => update('tack_debit_gaz', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  placeholder="—"
                />
              </div>
            </div>
          )}

          {/* ===== SECTION 3: SOUDURE FINALE ===== */}
          <SectionHeader
            title="Soudure Finale (Offline)"
            icon={<Flame className="w-5 h-5 text-orange-600" />}
            color="orange"
            open={openSections.soudure}
            onToggle={() => toggleSection('soudure')}
          />
          {openSections.soudure && (
            <div className="pl-4 border-l-2 border-orange-200 space-y-4">
              <VitesseInput
                label="Vitesse de soudure finale"
                mValue={formData.soudure_vitesse_m}
                cmValue={formData.soudure_vitesse_cm}
                onMChange={(v) => update('soudure_vitesse_m', v)}
                onCmChange={(v) => update('soudure_vitesse_cm', v)}
              />
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de flux</label>
                  <select
                    value={formData.soudure_type_flux}
                    onChange={(e) => update('soudure_type_flux', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    {FLUX_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Têtes ID */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-100 rounded text-blue-700 text-xs font-bold flex items-center justify-center">ID</span>
                  Têtes Intérieures ({idHeads.length})
                </h4>
                <div className="space-y-2">
                  {heads.map((head, idx) => head.type === 'ID' && (
                    <HeadRow key={idx} head={head} index={idx} onUpdate={updateHead} />
                  ))}
                </div>
              </div>

              {/* Têtes OD */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-orange-100 rounded text-orange-700 text-xs font-bold flex items-center justify-center">OD</span>
                  Têtes Extérieures ({odHeads.length})
                </h4>
                <div className="space-y-2">
                  {heads.map((head, idx) => head.type === 'OD' && (
                    <HeadRow key={idx} head={head} index={idx} onUpdate={updateHead} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
              placeholder="Notes ou commentaires..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {editingId ? 'Enregistrer' : 'Créer le Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
 * Composant HeadRow (toggle + amp + volt)
 * ============================================ */
function HeadRow({ head, index, onUpdate }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      head.actif 
        ? 'bg-green-50 border-green-200' 
        : 'bg-red-50 border-red-200'
    }`}>
      <span className="text-sm font-bold text-gray-700 w-20">
        {head.type} Head N°{head.numero}
      </span>

      {/* Toggle */}
      <button
        type="button"
        onClick={() => onUpdate(index, 'actif')}
        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
          head.actif
            ? 'bg-green-500 text-white'
            : 'bg-red-400 text-white'
        }`}
      >
        {head.actif ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        {head.actif ? 'Oui' : 'Non'}
      </button>

      {/* Type de fil */}
      <select
        value={head.type_fil || '3.2mm'}
        onChange={(e) => onUpdate(index, 'type_fil', e.target.value)}
        disabled={!head.actif}
        className={`w-20 px-1.5 py-1.5 text-sm border rounded-lg text-center ${
          head.actif 
            ? 'border-gray-300 bg-white focus:ring-2 focus:ring-violet-500' 
            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        {FIL_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {/* Ampérage */}
      <div className="flex items-center gap-1">
        <input
          type="number" step="1" min="0"
          value={head.amperage}
          onChange={(e) => onUpdate(index, 'amperage', parseFloat(e.target.value) || 0)}
          disabled={!head.actif}
          className={`w-20 px-2 py-1.5 text-sm border rounded-lg text-center ${
            head.actif 
              ? 'border-gray-300 bg-white focus:ring-2 focus:ring-violet-500' 
              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        />
        <span className="text-xs text-gray-500">A</span>
      </div>

      {/* Voltage */}
      <div className="flex items-center gap-1">
        <input
          type="number" step="0.1" min="0"
          value={head.voltage}
          onChange={(e) => onUpdate(index, 'voltage', parseFloat(e.target.value) || 0)}
          disabled={!head.actif}
          className={`w-20 px-2 py-1.5 text-sm border rounded-lg text-center ${
            head.actif 
              ? 'border-gray-300 bg-white focus:ring-2 focus:ring-violet-500' 
              : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        />
        <span className="text-xs text-gray-500">V</span>
      </div>
    </div>
  );
}

/* ============================================
 * Section Header avec Accordion
 * ============================================ */
function SectionHeader({ title, icon, color, open, onToggle }) {
  const colorClasses = {
    blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800',
    orange: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-800',
  };
  const cls = colorClasses[color] || colorClasses.blue;

  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${cls}`}
    >
      {icon}
      <span className="font-semibold flex-1 text-left">{title}</span>
      {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
    </button>
  );
}

/* ============================================
 * Modal Détail (lecture seule)
 * ============================================ */
function DetailModal({ preset, onClose, formatVitesse, formatGaz }) {
  const idHeads = (preset.heads || []).filter(h => h.type === 'ID');
  const odHeads = (preset.heads || []).filter(h => h.type === 'OD');
  const diamInfo = DIAMETRES.find(d => d.pouce === preset.diametre_pouce);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-violet-50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{preset.numero}</h2>
              {preset.diametre_pouce && (
                <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                  Ø {preset.diametre_pouce}" ({diamInfo ? diamInfo.mm.toFixed(1) : preset.diametre_pouce * 25.4} mm)
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Créé par {preset.createur_prenom} {preset.createur_nom} le {new Date(preset.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-violet-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Formage */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-3">
              <Settings className="w-4 h-4" /> Formage
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Vitesse strip" value={formatVitesse(preset.strip_vitesse_m, preset.strip_vitesse_cm)} />
              <DetailRow label="Milling Edge" value={`${preset.milling_edge_gauche}° / ${preset.milling_edge_droit}°`} />
              {preset.pression_rouleaux && (
                <DetailRow label="Pression rouleaux" value={`${preset.pression_rouleaux} ${preset.pression_rouleaux_unite}`} />
              )}
            </div>
          </div>

          {/* Tackwelding */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700 mb-3">
              <Zap className="w-4 h-4" /> Tackwelding
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Ampérage" value={`${preset.tack_amperage} A`} />
              <DetailRow label="Voltage" value={`${preset.tack_voltage} V`} />
              <DetailRow label="Vitesse soudure" value={formatVitesse(preset.tack_vitesse_m, preset.tack_vitesse_cm)} />
              <DetailRow label="Type de gaz" value={formatGaz(preset.tack_type_gaz)} />
              {preset.tack_frequence && <DetailRow label="Fréquence" value={`${preset.tack_frequence} Hz`} />}
              {preset.tack_debit_gaz && <DetailRow label="Débit gaz" value={`${preset.tack_debit_gaz} L/min`} />}
            </div>
          </div>

          {/* Soudure Finale */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-orange-700 mb-3">
              <Flame className="w-4 h-4" /> Soudure Finale
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <DetailRow label="Vitesse soudure" value={formatVitesse(preset.soudure_vitesse_m, preset.soudure_vitesse_cm)} />
              <DetailRow label="Type de flux" value={preset.soudure_type_flux} />
            </div>

            {/* Têtes */}
            <div className="space-y-2">
              {[...idHeads, ...odHeads].map((h, i) => (
                <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${
                  h.actif ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    h.type === 'ID' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>{h.type}</span>
                  <span className="font-medium text-gray-800 text-sm">Head N°{h.numero}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    h.actif ? 'bg-green-500 text-white' : 'bg-red-400 text-white'
                  }`}>
                    {h.actif ? 'Oui' : 'Non'}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                    {h.type_fil || '3.2mm'}
                  </span>
                  <span className="ml-auto text-sm font-mono">
                    <span className={h.actif ? 'text-gray-900' : 'text-red-400'}>{h.amperage} Amps</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className={h.actif ? 'text-gray-900' : 'text-red-400'}>{h.voltage} Volts</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {preset.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">{preset.notes}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
 * Modal Sélection Diamètre
 * ============================================ */
function DiametreModal({ onSelect, onClose }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-violet-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">Sélectionner le diamètre du tube</h2>
          <p className="text-sm text-gray-500 mt-1">Le preset sera associé à ce diamètre</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {DIAMETRES.map(d => (
              <button
                key={d.pouce}
                onClick={() => setSelected(d.pouce)}
                className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center ${
                  selected === d.pouce
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                    : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'
                }`}
              >
                <span className="text-lg font-bold text-gray-900">{d.pouce}"</span>
                <span className="text-xs text-gray-500">{d.mm.toFixed(1)} mm</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="flex items-center gap-2 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
 * Composant DetailRow
 * ============================================ */
function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
