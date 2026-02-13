/**
 * Migration: Système de langues pour LogiTrack
 * - Table langues (FR, EN, IT, AR)
 * - Table traductions (clé/valeur par langue)
 * - Colonne langue_preferee sur users et operateurs
 */

const pool = require('../config/database');

async function migrate() {
  try {
    console.log('🔄 Migration système de langues...');

    // 1. Table des langues disponibles
    await pool.query(`
      CREATE TABLE IF NOT EXISTS langues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(5) NOT NULL UNIQUE COMMENT 'Code ISO: fr, en, it, ar',
        nom VARCHAR(50) NOT NULL COMMENT 'Nom de la langue',
        nom_natif VARCHAR(50) NOT NULL COMMENT 'Nom dans la langue native',
        drapeau VARCHAR(10) DEFAULT '🏳️' COMMENT 'Emoji drapeau',
        direction VARCHAR(3) DEFAULT 'ltr' COMMENT 'ltr ou rtl',
        actif TINYINT(1) DEFAULT 1,
        par_defaut TINYINT(1) DEFAULT 0,
        ordre INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Table langues créée');

    // 2. Table des traductions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traductions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cle VARCHAR(255) NOT NULL COMMENT 'Clé de traduction: nav.dashboard, etc.',
        langue_code VARCHAR(5) NOT NULL,
        valeur TEXT NOT NULL COMMENT 'Texte traduit',
        categorie VARCHAR(50) DEFAULT 'general' COMMENT 'Catégorie pour regroupement',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_cle_langue (cle, langue_code),
        FOREIGN KEY (langue_code) REFERENCES langues(code) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  ✅ Table traductions créée');

    // 3. Ajouter colonne langue_preferee aux users et operateurs
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN langue_preferee VARCHAR(5) DEFAULT 'fr'`);
      console.log('  ✅ Colonne langue_preferee ajoutée à users');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Colonne langue_preferee déjà existante dans users');
      else throw e;
    }

    try {
      await pool.query(`ALTER TABLE operateurs ADD COLUMN langue_preferee VARCHAR(5) DEFAULT 'fr'`);
      console.log('  ✅ Colonne langue_preferee ajoutée à operateurs');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('  ℹ️ Colonne langue_preferee déjà existante dans operateurs');
      else throw e;
    }

    // 4. Insérer les 4 langues
    await pool.query(`
      INSERT IGNORE INTO langues (code, nom, nom_natif, drapeau, direction, actif, par_defaut, ordre) VALUES
      ('fr', 'Français', 'Français', 'fr', 'ltr', 1, 1, 1),
      ('en', 'Anglais', 'English', 'gb', 'ltr', 1, 0, 2),
      ('it', 'Italien', 'Italiano', 'it', 'ltr', 1, 0, 3),
      ('ar', 'Arabe', 'العربية', 'dz', 'rtl', 1, 0, 4)
    `);
    console.log('  ✅ 4 langues insérées (FR, EN, IT, AR)');

    // 5. Insérer les traductions par défaut
    const traductions = [
      // Navigation
      ['nav.dashboard', 'fr', 'Dashboard', 'navigation'],
      ['nav.dashboard', 'en', 'Dashboard', 'navigation'],
      ['nav.dashboard', 'it', 'Pannello di controllo', 'navigation'],
      ['nav.dashboard', 'ar', 'لوحة القيادة', 'navigation'],

      ['nav.bobines', 'fr', 'Bobines', 'navigation'],
      ['nav.bobines', 'en', 'Coils', 'navigation'],
      ['nav.bobines', 'it', 'Bobine', 'navigation'],
      ['nav.bobines', 'ar', 'البكرات', 'navigation'],

      ['nav.parametres_prod', 'fr', 'Paramètres Prod.', 'navigation'],
      ['nav.parametres_prod', 'en', 'Prod. Settings', 'navigation'],
      ['nav.parametres_prod', 'it', 'Param. Produzione', 'navigation'],
      ['nav.parametres_prod', 'ar', 'إعدادات الإنتاج', 'navigation'],

      ['nav.coulees', 'fr', 'Coulées', 'navigation'],
      ['nav.coulees', 'en', 'Heats', 'navigation'],
      ['nav.coulees', 'it', 'Colate', 'navigation'],
      ['nav.coulees', 'ar', 'الصهرات', 'navigation'],

      ['nav.checklist_machine', 'fr', 'Checklist Machine', 'navigation'],
      ['nav.checklist_machine', 'en', 'Machine Checklist', 'navigation'],
      ['nav.checklist_machine', 'it', 'Checklist Macchina', 'navigation'],
      ['nav.checklist_machine', 'ar', 'قائمة فحص الآلة', 'navigation'],

      ['nav.tubes', 'fr', 'Tubes', 'navigation'],
      ['nav.tubes', 'en', 'Pipes', 'navigation'],
      ['nav.tubes', 'it', 'Tubi', 'navigation'],
      ['nav.tubes', 'ar', 'الأنابيب', 'navigation'],

      ['nav.checklists_generales', 'fr', 'Checklists Générales', 'navigation'],
      ['nav.checklists_generales', 'en', 'General Checklists', 'navigation'],
      ['nav.checklists_generales', 'it', 'Checklist Generali', 'navigation'],
      ['nav.checklists_generales', 'ar', 'قوائم الفحص العامة', 'navigation'],

      ['nav.debut_quart', 'fr', 'Début de Quart', 'navigation'],
      ['nav.debut_quart', 'en', 'Shift Start', 'navigation'],
      ['nav.debut_quart', 'it', 'Inizio Turno', 'navigation'],
      ['nav.debut_quart', 'ar', 'بداية الوردية', 'navigation'],

      ['nav.hebdomadaire', 'fr', 'Hebdomadaire', 'navigation'],
      ['nav.hebdomadaire', 'en', 'Weekly', 'navigation'],
      ['nav.hebdomadaire', 'it', 'Settimanale', 'navigation'],
      ['nav.hebdomadaire', 'ar', 'أسبوعي', 'navigation'],

      ['nav.mensuelle', 'fr', 'Mensuelle', 'navigation'],
      ['nav.mensuelle', 'en', 'Monthly', 'navigation'],
      ['nav.mensuelle', 'it', 'Mensile', 'navigation'],
      ['nav.mensuelle', 'ar', 'شهري', 'navigation'],

      ['nav.etapes_production', 'fr', 'Étapes de Production', 'navigation'],
      ['nav.etapes_production', 'en', 'Production Steps', 'navigation'],
      ['nav.etapes_production', 'it', 'Fasi di Produzione', 'navigation'],
      ['nav.etapes_production', 'ar', 'مراحل الإنتاج', 'navigation'],

      // Administration
      ['nav.administration', 'fr', 'Administration', 'navigation'],
      ['nav.administration', 'en', 'Administration', 'navigation'],
      ['nav.administration', 'it', 'Amministrazione', 'navigation'],
      ['nav.administration', 'ar', 'الإدارة', 'navigation'],

      ['nav.logitracker', 'fr', 'LogiTracker', 'navigation'],
      ['nav.logitracker', 'en', 'LogiTracker', 'navigation'],
      ['nav.logitracker', 'it', 'LogiTracker', 'navigation'],
      ['nav.logitracker', 'ar', 'LogiTracker', 'navigation'],

      ['nav.parametres_projet', 'fr', 'Paramètres du Projet', 'navigation'],
      ['nav.parametres_projet', 'en', 'Project Settings', 'navigation'],
      ['nav.parametres_projet', 'it', 'Impostazioni Progetto', 'navigation'],
      ['nav.parametres_projet', 'ar', 'إعدادات المشروع', 'navigation'],

      ['nav.parametres_langue', 'fr', 'Paramètres de Langue', 'navigation'],
      ['nav.parametres_langue', 'en', 'Language Settings', 'navigation'],
      ['nav.parametres_langue', 'it', 'Impostazioni Lingua', 'navigation'],
      ['nav.parametres_langue', 'ar', 'إعدادات اللغة', 'navigation'],

      // Header & User Menu
      ['header.parametres', 'fr', 'Paramètres', 'header'],
      ['header.parametres', 'en', 'Settings', 'header'],
      ['header.parametres', 'it', 'Impostazioni', 'header'],
      ['header.parametres', 'ar', 'الإعدادات', 'header'],

      ['header.deconnexion', 'fr', 'Déconnexion', 'header'],
      ['header.deconnexion', 'en', 'Logout', 'header'],
      ['header.deconnexion', 'it', 'Disconnetti', 'header'],
      ['header.deconnexion', 'ar', 'تسجيل الخروج', 'header'],

      ['header.langue', 'fr', 'Langue', 'header'],
      ['header.langue', 'en', 'Language', 'header'],
      ['header.langue', 'it', 'Lingua', 'header'],
      ['header.langue', 'ar', 'اللغة', 'header'],

      // Common Actions
      ['common.sauvegarder', 'fr', 'Sauvegarder', 'common'],
      ['common.sauvegarder', 'en', 'Save', 'common'],
      ['common.sauvegarder', 'it', 'Salva', 'common'],
      ['common.sauvegarder', 'ar', 'حفظ', 'common'],

      ['common.annuler', 'fr', 'Annuler', 'common'],
      ['common.annuler', 'en', 'Cancel', 'common'],
      ['common.annuler', 'it', 'Annulla', 'common'],
      ['common.annuler', 'ar', 'إلغاء', 'common'],

      ['common.supprimer', 'fr', 'Supprimer', 'common'],
      ['common.supprimer', 'en', 'Delete', 'common'],
      ['common.supprimer', 'it', 'Elimina', 'common'],
      ['common.supprimer', 'ar', 'حذف', 'common'],

      ['common.modifier', 'fr', 'Modifier', 'common'],
      ['common.modifier', 'en', 'Edit', 'common'],
      ['common.modifier', 'it', 'Modifica', 'common'],
      ['common.modifier', 'ar', 'تعديل', 'common'],

      ['common.ajouter', 'fr', 'Ajouter', 'common'],
      ['common.ajouter', 'en', 'Add', 'common'],
      ['common.ajouter', 'it', 'Aggiungi', 'common'],
      ['common.ajouter', 'ar', 'إضافة', 'common'],

      ['common.rechercher', 'fr', 'Rechercher...', 'common'],
      ['common.rechercher', 'en', 'Search...', 'common'],
      ['common.rechercher', 'it', 'Cerca...', 'common'],
      ['common.rechercher', 'ar', '...بحث', 'common'],

      ['common.confirmer', 'fr', 'Confirmer', 'common'],
      ['common.confirmer', 'en', 'Confirm', 'common'],
      ['common.confirmer', 'it', 'Conferma', 'common'],
      ['common.confirmer', 'ar', 'تأكيد', 'common'],

      ['common.fermer', 'fr', 'Fermer', 'common'],
      ['common.fermer', 'en', 'Close', 'common'],
      ['common.fermer', 'it', 'Chiudi', 'common'],
      ['common.fermer', 'ar', 'إغلاق', 'common'],

      ['common.oui', 'fr', 'Oui', 'common'],
      ['common.oui', 'en', 'Yes', 'common'],
      ['common.oui', 'it', 'Sì', 'common'],
      ['common.oui', 'ar', 'نعم', 'common'],

      ['common.non', 'fr', 'Non', 'common'],
      ['common.non', 'en', 'No', 'common'],
      ['common.non', 'it', 'No', 'common'],
      ['common.non', 'ar', 'لا', 'common'],

      ['common.chargement', 'fr', 'Chargement...', 'common'],
      ['common.chargement', 'en', 'Loading...', 'common'],
      ['common.chargement', 'it', 'Caricamento...', 'common'],
      ['common.chargement', 'ar', '...جاري التحميل', 'common'],

      ['common.aucun_resultat', 'fr', 'Aucun résultat', 'common'],
      ['common.aucun_resultat', 'en', 'No results', 'common'],
      ['common.aucun_resultat', 'it', 'Nessun risultato', 'common'],
      ['common.aucun_resultat', 'ar', 'لا توجد نتائج', 'common'],

      ['common.actions', 'fr', 'Actions', 'common'],
      ['common.actions', 'en', 'Actions', 'common'],
      ['common.actions', 'it', 'Azioni', 'common'],
      ['common.actions', 'ar', 'إجراءات', 'common'],

      ['common.statut', 'fr', 'Statut', 'common'],
      ['common.statut', 'en', 'Status', 'common'],
      ['common.statut', 'it', 'Stato', 'common'],
      ['common.statut', 'ar', 'الحالة', 'common'],

      ['common.date', 'fr', 'Date', 'common'],
      ['common.date', 'en', 'Date', 'common'],
      ['common.date', 'it', 'Data', 'common'],
      ['common.date', 'ar', 'التاريخ', 'common'],

      ['common.nom', 'fr', 'Nom', 'common'],
      ['common.nom', 'en', 'Name', 'common'],
      ['common.nom', 'it', 'Nome', 'common'],
      ['common.nom', 'ar', 'الاسم', 'common'],

      ['common.description', 'fr', 'Description', 'common'],
      ['common.description', 'en', 'Description', 'common'],
      ['common.description', 'it', 'Descrizione', 'common'],
      ['common.description', 'ar', 'الوصف', 'common'],

      ['common.type', 'fr', 'Type', 'common'],
      ['common.type', 'en', 'Type', 'common'],
      ['common.type', 'it', 'Tipo', 'common'],
      ['common.type', 'ar', 'النوع', 'common'],

      ['common.total', 'fr', 'Total', 'common'],
      ['common.total', 'en', 'Total', 'common'],
      ['common.total', 'it', 'Totale', 'common'],
      ['common.total', 'ar', 'المجموع', 'common'],

      // Login
      ['login.titre', 'fr', 'Connexion', 'login'],
      ['login.titre', 'en', 'Login', 'login'],
      ['login.titre', 'it', 'Accesso', 'login'],
      ['login.titre', 'ar', 'تسجيل الدخول', 'login'],

      ['login.mot_de_passe', 'fr', 'Mot de passe', 'login'],
      ['login.mot_de_passe', 'en', 'Password', 'login'],
      ['login.mot_de_passe', 'it', 'Password', 'login'],
      ['login.mot_de_passe', 'ar', 'كلمة المرور', 'login'],

      ['login.se_connecter', 'fr', 'Se connecter', 'login'],
      ['login.se_connecter', 'en', 'Sign in', 'login'],
      ['login.se_connecter', 'it', 'Accedi', 'login'],
      ['login.se_connecter', 'ar', 'تسجيل الدخول', 'login'],

      ['login.code_operateur', 'fr', 'Code Opérateur', 'login'],
      ['login.code_operateur', 'en', 'Operator Code', 'login'],
      ['login.code_operateur', 'it', 'Codice Operatore', 'login'],
      ['login.code_operateur', 'ar', 'رمز المشغل', 'login'],

      // Footer
      ['footer.credit', 'fr', 'Coded with ❤️ by', 'footer'],
      ['footer.credit', 'en', 'Coded with ❤️ by', 'footer'],
      ['footer.credit', 'it', 'Coded with ❤️ by', 'footer'],
      ['footer.credit', 'ar', 'Coded with ❤️ by', 'footer'],

      // Dashboard
      ['dashboard.titre', 'fr', 'Tableau de Bord', 'dashboard'],
      ['dashboard.titre', 'en', 'Dashboard', 'dashboard'],
      ['dashboard.titre', 'it', 'Pannello di Controllo', 'dashboard'],
      ['dashboard.titre', 'ar', 'لوحة القيادة', 'dashboard'],

      ['dashboard.tubes_produits', 'fr', 'Tubes Produits', 'dashboard'],
      ['dashboard.tubes_produits', 'en', 'Produced Pipes', 'dashboard'],
      ['dashboard.tubes_produits', 'it', 'Tubi Prodotti', 'dashboard'],
      ['dashboard.tubes_produits', 'ar', 'الأنابيب المنتجة', 'dashboard'],

      ['dashboard.bobines_stock', 'fr', 'Bobines en Stock', 'dashboard'],
      ['dashboard.bobines_stock', 'en', 'Coils in Stock', 'dashboard'],
      ['dashboard.bobines_stock', 'it', 'Bobine in Stock', 'dashboard'],
      ['dashboard.bobines_stock', 'ar', 'البكرات في المخزن', 'dashboard'],

      ['dashboard.coulees_actives', 'fr', 'Coulées Actives', 'dashboard'],
      ['dashboard.coulees_actives', 'en', 'Active Heats', 'dashboard'],
      ['dashboard.coulees_actives', 'it', 'Colate Attive', 'dashboard'],
      ['dashboard.coulees_actives', 'ar', 'الصهرات النشطة', 'dashboard'],

      // Bobines
      ['bobines.titre', 'fr', 'Gestion des Bobines', 'bobines'],
      ['bobines.titre', 'en', 'Coils Management', 'bobines'],
      ['bobines.titre', 'it', 'Gestione Bobine', 'bobines'],
      ['bobines.titre', 'ar', 'إدارة البكرات', 'bobines'],

      ['bobines.nouvelle', 'fr', 'Nouvelle Bobine', 'bobines'],
      ['bobines.nouvelle', 'en', 'New Coil', 'bobines'],
      ['bobines.nouvelle', 'it', 'Nuova Bobina', 'bobines'],
      ['bobines.nouvelle', 'ar', 'بكرة جديدة', 'bobines'],

      ['bobines.numero', 'fr', 'N° Bobine', 'bobines'],
      ['bobines.numero', 'en', 'Coil N°', 'bobines'],
      ['bobines.numero', 'it', 'N° Bobina', 'bobines'],
      ['bobines.numero', 'ar', 'رقم البكرة', 'bobines'],

      // Coulées
      ['coulees.titre', 'fr', 'Gestion des Coulées', 'coulees'],
      ['coulees.titre', 'en', 'Heats Management', 'coulees'],
      ['coulees.titre', 'it', 'Gestione Colate', 'coulees'],
      ['coulees.titre', 'ar', 'إدارة الصهرات', 'coulees'],

      ['coulees.nouvelle', 'fr', 'Nouvelle Coulée', 'coulees'],
      ['coulees.nouvelle', 'en', 'New Heat', 'coulees'],
      ['coulees.nouvelle', 'it', 'Nuova Colata', 'coulees'],
      ['coulees.nouvelle', 'ar', 'صهرة جديدة', 'coulees'],

      // Tubes
      ['tubes.titre', 'fr', 'Gestion des Tubes', 'tubes'],
      ['tubes.titre', 'en', 'Pipes Management', 'tubes'],
      ['tubes.titre', 'it', 'Gestione Tubi', 'tubes'],
      ['tubes.titre', 'ar', 'إدارة الأنابيب', 'tubes'],

      ['tubes.nouveau', 'fr', 'Nouveau Tube', 'tubes'],
      ['tubes.nouveau', 'en', 'New Pipe', 'tubes'],
      ['tubes.nouveau', 'it', 'Nuovo Tubo', 'tubes'],
      ['tubes.nouveau', 'ar', 'أنبوب جديد', 'tubes'],

      // Messages
      ['msg.succes_sauvegarde', 'fr', 'Sauvegardé avec succès', 'messages'],
      ['msg.succes_sauvegarde', 'en', 'Saved successfully', 'messages'],
      ['msg.succes_sauvegarde', 'it', 'Salvato con successo', 'messages'],
      ['msg.succes_sauvegarde', 'ar', 'تم الحفظ بنجاح', 'messages'],

      ['msg.erreur_serveur', 'fr', 'Erreur serveur', 'messages'],
      ['msg.erreur_serveur', 'en', 'Server error', 'messages'],
      ['msg.erreur_serveur', 'it', 'Errore del server', 'messages'],
      ['msg.erreur_serveur', 'ar', 'خطأ في الخادم', 'messages'],

      ['msg.confirmer_suppression', 'fr', 'Êtes-vous sûr de vouloir supprimer ?', 'messages'],
      ['msg.confirmer_suppression', 'en', 'Are you sure you want to delete?', 'messages'],
      ['msg.confirmer_suppression', 'it', 'Sei sicuro di voler eliminare?', 'messages'],
      ['msg.confirmer_suppression', 'ar', 'هل أنت متأكد من الحذف؟', 'messages'],

      // Langue settings page
      ['langue.titre', 'fr', 'Paramètres de Langue', 'langue'],
      ['langue.titre', 'en', 'Language Settings', 'langue'],
      ['langue.titre', 'it', 'Impostazioni Lingua', 'langue'],
      ['langue.titre', 'ar', 'إعدادات اللغة', 'langue'],

      ['langue.description', 'fr', 'Gérer les langues et les traductions de l\'application', 'langue'],
      ['langue.description', 'en', 'Manage application languages and translations', 'langue'],
      ['langue.description', 'it', 'Gestisci le lingue e le traduzioni dell\'applicazione', 'langue'],
      ['langue.description', 'ar', 'إدارة لغات وترجمات التطبيق', 'langue'],

      ['langue.langues_disponibles', 'fr', 'Langues Disponibles', 'langue'],
      ['langue.langues_disponibles', 'en', 'Available Languages', 'langue'],
      ['langue.langues_disponibles', 'it', 'Lingue Disponibili', 'langue'],
      ['langue.langues_disponibles', 'ar', 'اللغات المتاحة', 'langue'],

      ['langue.par_defaut', 'fr', 'Par défaut', 'langue'],
      ['langue.par_defaut', 'en', 'Default', 'langue'],
      ['langue.par_defaut', 'it', 'Predefinita', 'langue'],
      ['langue.par_defaut', 'ar', 'افتراضي', 'langue'],

      ['langue.traductions', 'fr', 'Traductions', 'langue'],
      ['langue.traductions', 'en', 'Translations', 'langue'],
      ['langue.traductions', 'it', 'Traduzioni', 'langue'],
      ['langue.traductions', 'ar', 'الترجمات', 'langue'],
    ];

    // Insert avec INSERT IGNORE pour ne pas dupliquer
    for (const [cle, langue_code, valeur, categorie] of traductions) {
      await pool.query(
        'INSERT IGNORE INTO traductions (cle, langue_code, valeur, categorie) VALUES (?, ?, ?, ?)',
        [cle, langue_code, valeur, categorie]
      );
    }
    console.log(`  ✅ ${traductions.length} traductions insérées`);

    console.log('✅ Migration système de langues terminée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrate();
