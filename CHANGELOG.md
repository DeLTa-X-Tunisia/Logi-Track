# Changelog

Toutes les modifications notables de LogiTrack sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

---

## [2.1.0] — 15 Février 2026

### Ajouté
- **Audit trail** : journal complet des actions (login, CRUD, validation, décision finale) avec table `audit_trail` et route `GET /api/audit`
- **Health check** : route `GET /api/health` retournant version, statut DB, uptime au format JSON
- **ErrorBoundary** : composant React de capture d'erreurs avec UI de récupération
- **Checklist Périodique** : nouveau type de checklist avec récurrence configurable et suivi de validité
- **ChecklistAlert** : composant d'alerte pour les checklists expirées/à venir
- **Application Android** : WebView Java avec découverte mDNS (NsdManager) et APK téléchargeable

### Amélioré
- **Launcher v2.1.0** : refonte complète du Launcher Desktop
  - 3 cartes de services (MySQL + Backend + Frontend) au lieu de 2
  - Détection automatique de MySQL (processus + test connexion)
  - Vérification pré-vol MySQL avant démarrage du backend
  - Health check enrichi : parsing JSON (version, statut DB, uptime)
  - Header temps réel avec version serveur, statut DB et uptime
  - Bouton « Dossier Projet » pour ouvrir l'Explorateur
  - Minimisation en System Tray avec menu contextuel
  - Notifications ballon quand les services sont prêts
  - Dialogue de fermeture intelligent (Arrêter / Minimiser / Annuler)
  - Barre de statut avec compteur 3 services
  - Infos supplémentaires par carte (version, statut DB, URL, erreurs)
- **Dashboard** : requêtes parallélisées avec `Promise.all` (7 requêtes simultanées)
- **Code splitting** : 14 pages chargées en lazy loading via `React.lazy` + `Suspense` (13 chunks)

### Sécurité
- **Helmet** : headers HTTP sécurisés (CSP, HSTS, X-Frame-Options, etc.)
- **Rate limiting** : protection contre les abus — 20 requêtes auth/15min, 300 API/15min
- **CORS restrictif** : origines configurables via `CORS_ORIGINS` (env variable)
- **Uploads protégés** : authentification JWT requise pour accéder aux fichiers uploadés
- **JWT encapsulé** : secret non exporté, fonction `signToken()` centralisée dans le middleware

### Performance
- **Fix N+1** : requêtes batch `WHERE IN()` pour tubes, paramètres soudage, checklists périodiques
- **Pagination** : support `?page=&limit=` sur les routes liste avec metadata (total, totalPages, currentPage)
- **13 index DB** : index sur les colonnes critiques (FK, statut, recherche, tri)

---

## [2.0.0] — 14 Février 2026

### Ajouté
- **Certificats PDF** : génération de certificats de conformité API 5L et Hydraulique avec design premium (fond blanc, économe en encre, double cadre, ornements d'angle, sceau, zones de signature)
- **Décision Finale premium** : encadré thématisé dans le rapport tube — thème or/marine (API 5L), cyan/bleu (Hydraulique), orange/brique (Déclassé) avec gradient, ornements, sceau et numéro de certificat
- **Paramètres de soudage** : section dédiée dans le rapport PDF tube avec tableau des paramètres de soudage de la coulée
- **Analyse des temps** : tableau d'analyse des temps et délais inter-étapes dans le rapport PDF tube, avec identification des goulots d'étranglement
- **Photos d'étapes** : prise et affichage de photos à chaque étape de production, intégrées dans le rapport PDF
- **Bouton certificat** : icône Award dans les cartes tubes et le modal détail pour téléchargement direct du certificat (visible uniquement pour tubes certifiés)
- **En-tête rapport PDF** : logos client et projet dans l'en-tête des rapports tubes (même style que bobines)
- **Résumé des performances** : cartes alignées dans le rapport PDF tube

### Amélioré
- **Rapport tube PDF** : refonte complète multi-pages avec mise en page professionnelle
- **Certificats** : version light/blanc pour impression économique (remplacement de la version sombre)
- **Alignement PDF** : correction des problèmes d'alignement des tableaux (Y-position PDFKit)

---

## [1.5.0] — 14 Février 2026

### Ajouté
- **PWA** : mode Progressive Web App avec installation sur mobile/desktop, fullscreen sans barre navigateur
- **Guide PWA Samsung** : guide d'installation manuelle pour navigateurs sans support beforeinstallprompt
- **HTTPS** : serveur Express en double mode HTTP:3002 + HTTPS:3443 avec certificat SSL
- **Icône PDF tubes** : accès rapide au rapport PDF depuis la liste des tubes

### Amélioré
- **Architecture réseau** : HTTP et HTTPS fonctionnent en parallèle pour dev et Android
- **PWA icons** : icônes carrées 192x192 et 512x512 conformes aux standards
- **Frontend servi depuis backend** : build frontend distribué par le serveur Express

---

## [1.2.0] — 13 Février 2026

### Ajouté
- **Coulées** : ouverture directe du modal détail après création d'une coulée
- **Coulées** : affichage "Coulée démarrée le [date/heure]" dans l'étape 1 pour traçabilité du temps perdu

### Amélioré
- **Sidebar** : titre simplifié "PROJET – Nom du Client"
- **Traductions** : corrections des traductions manquantes pour le rôle Direction dans la liste des comptes

---

## [1.1.0] — 13 Février 2026

### Ajouté
- **Paramètres de Production** : sélection du diamètre du tube (8" à 82") avec numérotation `PAR-{diamètre}-{seq}` et groupement par diamètre
- **Fournisseurs** : gestion complète dans le formulaire Bobines — liste déroulante, ajout, suppression avec confirmation

### Amélioré
- **Sidebar** : restructuration — section "Projet" (Dashboard, Checklists) + section "Étapes de Production" (Bobines, Paramètres, Coulées, etc.)

---

## [1.0.0] — 13 Février 2026

### Ajouté
- **Release initiale** : LogiTrack ERP complet
- **Dashboard** : vue d'ensemble de la production avec statistiques
- **Bobines** : gestion complète avec photos et rapports PDF
- **Coulées** : workflow de gestion des coulées d'acier
- **Tubes** : suivi individuel à travers 12 étapes de production API 5L
- **Checklists** : début de quart, hebdomadaire, mensuelle
- **Checklist Machine** : vérification de l'état des machines
- **Paramètres de Production** : configuration par diamètre
- **Système i18n** : 4 langues (FR, EN, IT, AR) avec support RTL complet
- **Authentification** : JWT avec admin + opérateurs par code 6 chiffres
- **PDF** : génération de rapports bobines
- **Temps réel** : notifications Socket.io
- **Paramètres du Projet** : logos, infos client, configuration globale
- **Gestion des Comptes** : admin, opérateurs, direction
- **LogiTrack Launcher** : application bureau C# WinForms (.NET 8)
