import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const I18nContext = createContext(null);

// Traductions par défaut (fallback français) intégrées pour éviter les flashs
const defaultTranslations = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.bobines': 'Bobines',
  'nav.parametres_prod': 'Paramètres Prod.',
  'nav.coulees': 'Coulées',
  'nav.checklist_machine': 'Checklist Machine',
  'nav.tubes': 'Tubes',
  'nav.checklists_generales': 'Checklists Générales',
  'nav.debut_quart': 'Début de Quart',
  'nav.hebdomadaire': 'Hebdomadaire',
  'nav.mensuelle': 'Mensuelle',
  'nav.etapes_production': 'Étapes de Production',
  'nav.administration': 'Administration',
  'nav.logitracker': 'LogiTracker',
  'nav.parametres_projet': 'Paramètres du Projet',
  'nav.parametres_langue': 'Paramètres de Langue',
  'nav.gestion_comptes': 'Gestion des Comptes',

  // Header
  'header.parametres': 'Paramètres',
  'header.deconnexion': 'Déconnexion',
  'header.langue': 'Langue',
  'header.certification': 'Certification API 5L',
  'header.version': 'Version 1.0.0',

  // Common
  'common.sauvegarder': 'Sauvegarder',
  'common.enregistrer': 'Enregistrer',
  'common.annuler': 'Annuler',
  'common.supprimer': 'Supprimer',
  'common.modifier': 'Modifier',
  'common.ajouter': 'Ajouter',
  'common.rechercher': 'Rechercher...',
  'common.confirmer': 'Confirmer',
  'common.fermer': 'Fermer',
  'common.oui': 'Oui',
  'common.non': 'Non',
  'common.chargement': 'Chargement...',
  'common.aucun_resultat': 'Aucun résultat',
  'common.actions': 'Actions',
  'common.statut': 'Statut',
  'common.date': 'Date',
  'common.nom': 'Nom',
  'common.description': 'Description',
  'common.type': 'Type',
  'common.total': 'Total',
  'common.erreur': 'Erreur',
  'common.succes': 'Succès',
  'common.retour': 'Retour',
  'common.voir': 'Voir',
  'common.telecharger': 'Télécharger',
  'common.exporter': 'Exporter',

  // Login
  'login.titre': 'Connexion',
  'login.mot_de_passe': 'Mot de passe',
  'login.se_connecter': 'Se connecter',
  'login.code_operateur': 'Code Opérateur',
  'login.titre_operateur': 'Opérateur',
  'login.titre_admin': 'Administration',
  'login.entrer_code': 'Entrez votre code à 6 chiffres',
  'login.identifiant': 'Identifiant',
  'login.connexion_operateur': 'Connexion Opérateur',
  'login.connexion_admin': 'Connexion Admin',
  'login.bienvenue': 'Bienvenue sur',
  'login.sous_titre': 'Système de suivi de production',
  'login.code_placeholder': '000000',
  'login.erreur_code': 'Code opérateur invalide',
  'login.erreur_identifiants': 'Identifiants incorrects',

  // Footer
  'footer.credit': 'Coded with ❤️ by',

  // Dashboard
  'dashboard.titre': 'Tableau de Bord',
  'dashboard.tubes_produits': 'Tubes Produits',
  'dashboard.bobines_stock': 'Bobines en Stock',
  'dashboard.coulees_actives': 'Coulées Actives',
  'dashboard.production_jour': 'Production du Jour',
  'dashboard.pipeline': 'Pipeline de Production',
  'dashboard.activite_recente': 'Activité Récente',
  'dashboard.aucune_activite': 'Aucune activité récente',
  'dashboard.taux_conformite': 'Taux de Conformité',
  'dashboard.derniere_coulee': 'Dernière Coulée',
  'dashboard.bobines_recentes': 'Bobines Récentes',
  'dashboard.coulees_recentes': 'Coulées Récentes',
  'dashboard.il_y_a': 'il y a',
  'dashboard.secondes': 'secondes',
  'dashboard.minutes': 'minutes',
  'dashboard.heures': 'heures',
  'dashboard.jours': 'jours',
  'dashboard.a_linstant': "à l'instant",

  // Bobines
  'bobines.titre': 'Gestion des Bobines',
  'bobines.nouvelle': 'Nouvelle Bobine',
  'bobines.numero': 'N° Bobine',
  'bobines.numero_coulee': 'N° Coulée',
  'bobines.epaisseur': 'Épaisseur',
  'bobines.largeur': 'Largeur',
  'bobines.poids': 'Poids',
  'bobines.fournisseur': 'Fournisseur',
  'bobines.date_reception': 'Date Réception',
  'bobines.en_stock': 'En Stock',
  'bobines.en_production': 'En Production',
  'bobines.consommee': 'Consommée',
  'bobines.stats_total': 'Total Bobines',
  'bobines.stats_stock': 'En Stock',
  'bobines.stats_production': 'En Production',
  'bobines.stats_consommees': 'Consommées',
  'bobines.rechercher': 'Rechercher une bobine...',
  'bobines.toutes': 'Toutes',
  'bobines.filtre_stock': 'En Stock',
  'bobines.filtre_production': 'En Production',
  'bobines.filtre_consommee': 'Consommée',
  'bobines.aucune': 'Aucune bobine trouvée',
  'bobines.modifier_bobine': 'Modifier la bobine',
  'bobines.nouvelle_bobine': 'Nouvelle bobine',
  'bobines.confirmer_suppression': 'Supprimer cette bobine ?',
  'bobines.msg_creee': 'Bobine créée avec succès',
  'bobines.msg_modifiee': 'Bobine modifiée avec succès',
  'bobines.msg_supprimee': 'Bobine supprimée avec succès',
  'bobines.photos': 'Photos',
  'bobines.ajouter_photo': 'Ajouter une photo',
  'bobines.detail': 'Détail Bobine',
  'bobines.pdf': 'Télécharger PDF',
  'bobines.qualite': 'Qualité',
  'bobines.observations': 'Observations',
  'bobines.mm': 'mm',
  'bobines.kg': 'kg',

  // Coulées
  'coulees.titre': 'Gestion des Coulées',
  'coulees.nouvelle': 'Nouvelle Coulée',
  'coulees.numero': 'N° Coulée',
  'coulees.fournisseur': 'Fournisseur',
  'coulees.grade_acier': 'Grade Acier',
  'coulees.date_reception': 'Date Réception',
  'coulees.statut': 'Statut',
  'coulees.rechercher': 'Rechercher une coulée...',
  'coulees.toutes': 'Toutes',
  'coulees.aucune': 'Aucune coulée trouvée',
  'coulees.reception': 'Réception',
  'coulees.installation': 'Installation',
  'coulees.checklist': 'Checklist',
  'coulees.production': 'Production',
  'coulees.terminee': 'Terminée',
  'coulees.nouvelle_coulee': 'Nouvelle coulée',
  'coulees.modifier_coulee': 'Modifier la coulée',
  'coulees.confirmer_suppression': 'Supprimer cette coulée ?',
  'coulees.msg_creee': 'Coulée créée avec succès',
  'coulees.msg_modifiee': 'Coulée modifiée avec succès',
  'coulees.msg_supprimee': 'Coulée supprimée avec succès',
  'coulees.detail': 'Détail Coulée',
  'coulees.bobines_associees': 'Bobines Associées',
  'coulees.tubes_produits': 'Tubes Produits',
  'coulees.avancement': 'Avancement',
  'coulees.etape': 'Étape',
  'coulees.stats_total': 'Total',
  'coulees.stats_actives': 'Actives',
  'coulees.stats_terminees': 'Terminées',

  // Checklist
  'checklist.titre': 'Checklist Machine',
  'checklist.non_verifie': 'Non vérifié',
  'checklist.conforme': 'Conforme',
  'checklist.non_conforme': 'Non conforme',
  'checklist.corrige': 'Corrigé',
  'checklist.retour': 'Retour',
  'checklist.btn_conforme': 'Conforme',
  'checklist.btn_defaut': 'Défaut',
  'checklist.corriger': 'Corriger',
  'checklist.tout_valider': 'Tout valider',
  'checklist.validee': 'Validée',
  'checklist.critique': 'CRITIQUE',
  'checklist.verifie_le': 'Vérifié le:',
  'checklist.par': 'Par:',
  'checklist.defaut_label': 'Défaut:',
  'checklist.correction_label': 'Correction:',
  'checklist.corrige_le': 'Corrigé le:',
  'checklist.chargement': 'Chargement de la checklist...',
  'checklist.points_totaux': 'Points totaux',
  'checklist.conformes': 'Conformes',
  'checklist.non_conformes': 'Non conformes',
  'checklist.corriges': 'Corrigés',
  'checklist.non_verifies': 'Non vérifiés',
  'checklist.validee_titre': 'Checklist Validée',
  'checklist.en_cours': 'En cours de validation',
  'checklist.points_critiques': 'point(s) critique(s)',
  'checklist.points_controle': 'points de contrôle',
  'checklist.valider_checklist': 'Valider la Checklist Machine',
  'checklist.retour_coulees': 'Retour aux Coulées - Démarrer la Production',
  'checklist.signaler_defaut': 'Signaler un défaut',
  'checklist.signaler_correction': 'Signaler une correction',
  'checklist.defaut_detecte': 'Défaut détecté *',
  'checklist.action_corrective': 'Action corrective',
  'checklist.commentaire_additionnel': 'Commentaire additionnel',
  'checklist.placeholder_defaut': 'Décrivez le défaut constaté...',
  'checklist.placeholder_correction': "Décrivez l'action corrective...",
  'checklist.placeholder_commentaire': 'Commentaire optionnel...',
  'checklist.marquer_corrige': 'Marquer Corrigé',
  'checklist.msg_validee': 'Checklist Machine validée avec succès!',
  'checklist.msg_section_validee': 'Tous les points de cette section sont déjà validés',

  // Comptes
  'comptes.titre': 'Gestion des Comptes',
  'comptes.nouveau': 'Nouveau Compte',
  'comptes.rechercher': 'Rechercher un opérateur...',
  'comptes.tous': 'Tous',
  'comptes.operateurs': 'Opérateurs',
  'comptes.admins': 'Admins',
  'comptes.total': 'Total',
  'comptes.actifs': 'Actifs',
  'comptes.operateur': 'Opérateur',
  'comptes.admin': 'Admin',
  'comptes.nom': 'Nom',
  'comptes.prenom': 'Prénom',
  'comptes.code_operateur': 'Code Opérateur',
  'comptes.departement': 'Département',
  'comptes.qualification': 'Qualification',
  'comptes.nom_utilisateur': "Nom d'utilisateur",
  'comptes.mot_de_passe': 'Mot de passe',
  'comptes.role': 'Rôle',
  'comptes.creer': 'Créer',
  'comptes.modifier': 'Modifier',
  'comptes.supprimer': 'Supprimer',
  'comptes.statut': 'Statut',
  'comptes.actif': 'Actif',
  'comptes.inactif': 'Inactif',
  'comptes.actions': 'Actions',
  'comptes.promouvoir_admin': 'Promouvoir Admin',
  'comptes.revoquer_admin': 'Révoquer Admin',
  'comptes.generer_code': 'Générer Code',
  'comptes.msg_code_genere': 'Code généré avec succès',
  'comptes.msg_compte_cree': 'Compte créé avec succès',
  'comptes.msg_compte_modifie': 'Compte modifié avec succès',
  'comptes.msg_compte_supprime': 'Compte supprimé avec succès',
  'comptes.aucun_operateur': 'Aucun opérateur trouvé',
  'comptes.modifier_compte': 'Modifier le compte',
  'comptes.nouveau_compte': 'Nouveau compte',
  'comptes.confirmer_suppression': 'Êtes-vous sûr de vouloir supprimer',
  'comptes.action_irreversible': 'Cette action est irréversible',
  'comptes.role_direction': 'Rôle Direction',
  'comptes.direction_none': 'Aucun',
  'comptes.direction_chef_projet': 'Chef de Projet',
  'comptes.direction_chef_chantier': 'Chef de Chantier',

  // Departments
  'dept.production': 'Production',
  'dept.qualite': 'Qualité',
  'dept.maintenance': 'Maintenance',
  'dept.logistique': 'Logistique',
  'dept.magasin': 'Magasin',
  'dept.administration': 'Administration',

  // Tubes
  'tubes.titre': 'Gestion des Tubes',
  'tubes.nouveau': 'Nouveau Tube',

  // Messages
  'msg.succes_sauvegarde': 'Sauvegardé avec succès',
  'msg.erreur_serveur': 'Erreur serveur',
  'msg.confirmer_suppression': 'Êtes-vous sûr de vouloir supprimer ?',

  // Langue settings
  'langue.titre': 'Paramètres de Langue',
  'langue.description': 'Gérer les langues et les traductions de l\'application',
  'langue.langues_disponibles': 'Langues Disponibles',
  'langue.par_defaut': 'Par défaut',
  'langue.traductions': 'Traductions',
};

export function I18nProvider({ children }) {
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('logitrack_langue') || 'fr';
  });
  const [translations, setTranslations] = useState(defaultTranslations);
  const [langues, setLangues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Charger les langues disponibles
  const fetchLangues = useCallback(async () => {
    try {
      const response = await api.get('/langues');
      setLangues(response.data.langues || []);
    } catch (error) {
      console.error('Erreur chargement langues:', error);
    }
  }, []);

  // Charger les traductions pour la langue courante
  const fetchTranslations = useCallback(async (langCode) => {
    try {
      const response = await api.get(`/langues/traductions/${langCode}`);
      setTranslations(prev => ({
        ...defaultTranslations,
        ...response.data.traductions
      }));
    } catch (error) {
      console.error('Erreur chargement traductions:', error);
      // Fallback vers les traductions par défaut
      setTranslations(defaultTranslations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLangues();
    fetchTranslations(currentLang);
  }, [currentLang, fetchLangues, fetchTranslations]);

  // Écouter les changements de langue depuis AuthContext (login)
  useEffect(() => {
    const handleLangChange = () => {
      const lang = localStorage.getItem('logitrack_langue') || 'fr';
      if (lang !== currentLang) {
        setCurrentLang(lang);
      }
    };
    window.addEventListener('langue-changed', handleLangChange);
    return () => window.removeEventListener('langue-changed', handleLangChange);
  }, [currentLang]);

  // Appliquer la direction RTL/LTR
  useEffect(() => {
    const langue = langues.find(l => l.code === currentLang);
    if (langue) {
      document.documentElement.dir = langue.direction || 'ltr';
      document.documentElement.lang = currentLang;
    }
  }, [currentLang, langues]);

  // Changer de langue
  const changeLanguage = useCallback(async (langCode) => {
    setCurrentLang(langCode);
    localStorage.setItem('logitrack_langue', langCode);

    // Sauvegarder la préférence sur le serveur si connecté
    try {
      const token = localStorage.getItem('logitrack_token');
      if (token) {
        await api.put('/langues/user-preference', { langue_code: langCode });
      }
    } catch (error) {
      // Silently fail - la préférence locale suffit
    }
  }, []);

  // Fonction de traduction
  const t = useCallback((key, fallback) => {
    return translations[key] || fallback || key;
  }, [translations]);

  // Recharger les traductions (après modification admin)
  const reloadTranslations = useCallback(() => {
    fetchTranslations(currentLang);
    fetchLangues();
  }, [currentLang, fetchTranslations, fetchLangues]);

  const value = {
    t,
    currentLang,
    langues: langues.filter(l => l.actif),
    allLangues: langues,
    changeLanguage,
    reloadTranslations,
    loading,
    direction: langues.find(l => l.code === currentLang)?.direction || 'ltr'
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation doit être utilisé dans un I18nProvider');
  }
  return context;
}

export default I18nContext;
