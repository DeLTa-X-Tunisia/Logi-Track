import axios from 'axios';

// Utiliser l'hostname actuel du navigateur pour supporter l'accès réseau
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3002/api`;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('logitrack_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const errorCode = error.response?.data?.code;
      if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID') {
        localStorage.removeItem('logitrack_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================
// API Bobines
// ============================================
export const bobinesApi = {
  getAll: () => api.get('/bobines'),
  getById: (id) => api.get(`/bobines/${id}`),
  getStats: () => api.get('/bobines/stats'),
  getSteelGrades: () => api.get('/bobines/steel-grades'),
  create: (data) => api.post('/bobines', data),
  update: (id, data) => api.put(`/bobines/${id}`, data),
  updateStatut: (id, statut) => api.put(`/bobines/${id}/statut`, { statut }),
  delete: (id) => api.delete(`/bobines/${id}`),
  getPhotos: (id) => api.get(`/bobines/${id}/photos`),
  uploadPhotos: (id, formData) => api.post(`/bobines/${id}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deletePhoto: (bobineId, photoId) => api.delete(`/bobines/${bobineId}/photos/${photoId}`)
};

// ============================================
// API Steel Grades
// ============================================
export const steelGradesApi = {
  getAll: (params) => api.get('/bobines/steel-grades', { params })
};

// ============================================
// API Fournisseurs
// ============================================
export const fournisseursApi = {
  getAll: () => api.get('/fournisseurs'),
  create: (data) => api.post('/fournisseurs', data),
  delete: (id) => api.delete(`/fournisseurs/${id}`),
};

// ============================================
// API Coulées
// ============================================
export const couleesApi = {
  getAll: () => api.get('/coulees'),
  getById: (id) => api.get(`/coulees/${id}`),
  getStats: () => api.get('/coulees/stats'),
  getProchainNumero: () => api.get('/coulees/prochain-numero'),
  getBobinesDisponibles: () => api.get('/coulees/bobines-disponibles'),
  getMotifsRetard: (etape) => api.get('/coulees/motifs-retard', { params: etape ? { etape } : {} }),
  create: (data) => api.post('/coulees', data),
  delete: (id) => api.delete(`/coulees/${id}`),
  // Workflow
  updateReception: (id, data) => api.put(`/coulees/${id}/reception`, data),
  updateInstallation: (id, data) => api.put(`/coulees/${id}/installation`, data),
  startProduction: (id) => api.put(`/coulees/${id}/start-production`),
  stopProduction: (id) => api.put(`/coulees/${id}/stop-production`),
  reset: (id) => api.put(`/coulees/${id}/reset`),
};

// ============================================
// API Comptes (opérateurs / utilisateurs)
// ============================================
export const comptesApi = {
  getAll: (params) => api.get('/comptes', { params }),
  getById: (id) => api.get(`/comptes/${id}`),
  getStats: () => api.get('/comptes/stats'),
  create: (data) => api.post('/comptes', data),
  update: (id, data) => api.put(`/comptes/${id}`, data),
  delete: (id) => api.delete(`/comptes/${id}`),
  promote: (id, isAdmin) => api.put(`/comptes/${id}/promote`, { is_admin: isAdmin }),
  activate: (id) => api.put(`/comptes/${id}/activate`),
  regenerateCode: (id) => api.put(`/comptes/${id}/regenerate-code`),
};

// ============================================
// API Checklist Machine
// ============================================
export const checklistApi = {
  getItems: () => api.get('/checklist/items'),
  getByCoulee: (couleeId) => api.get(`/checklist/coulee/${couleeId}`),
  validateItem: (data) => api.put('/checklist/valider-item', data),
  validateComplete: (couleeId) => api.post(`/checklist/valider-complete/${couleeId}`),
};

// ============================================
// API Tubes
// ============================================
export const tubesApi = {
  getAll: (params) => api.get('/tubes', { params }),
  getById: (id) => api.get(`/tubes/${id}`),
  create: (data) => api.post('/tubes', data),
  updateEtape: (id, data) => api.put(`/tubes/${id}/etape`, data),
};

// ============================================
// API Étapes de production
// ============================================
export const etapesApi = {
  getAll: () => api.get('/etapes'),
  getById: (id) => api.get(`/etapes/${id}`),
  getByTube: (tubeId) => api.get(`/etapes/tube/${tubeId}`),
};

// ============================================
// API Checklists Périodiques
// ============================================
export const checklistPeriodiqueApi = {
  getTypes: () => api.get('/checklist-periodique/types'),
  getStatut: () => api.get('/checklist-periodique/statut'),
  getOperateurs: () => api.get('/checklist-periodique/operateurs'),
  startSession: (typeId, operateurId) => api.post(`/checklist-periodique/session/${typeId}`, { operateur_id: operateurId }),
  getSession: (sessionId) => api.get(`/checklist-periodique/session/${sessionId}`),
  validateItem: (data) => api.put('/checklist-periodique/valider-item', data),
  validateSession: (sessionId) => api.post(`/checklist-periodique/valider-session/${sessionId}`),
  getHistorique: (typeId) => api.get(`/checklist-periodique/historique/${typeId}`),
  deleteSession: (sessionId) => api.delete(`/checklist-periodique/session/${sessionId}`),
};

// ============================================
// API Dashboard
// ============================================
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export default api;
