const pool = require('../config/database');

async function migrateExtraTranslations() {
  const conn = await pool.getConnection();
  
  try {
    // Additional translation keys that may be missing
    const translations = [
      // Header
      ['header.certification', 'Certification API 5L', 'API 5L Certification', 'Certificazione API 5L', 'شهادة API 5L'],
      ['header.version', 'Version 1.0.0', 'Version 1.0.0', 'Versione 1.0.0', 'الإصدار 1.0.0'],

      // Login extras
      ['login.titre_operateur', 'Opérateur', 'Operator', 'Operatore', 'مشغل'],
      ['login.titre_admin', 'Administration', 'Administration', 'Amministrazione', 'إدارة'],
      ['login.entrer_code', 'Entrez votre code à 6 chiffres', 'Enter your 6-digit code', 'Inserisci il tuo codice a 6 cifre', 'أدخل رمزك المكون من 6 أرقام'],
      ['login.identifiant', 'Identifiant', 'Username', 'Nome utente', 'اسم المستخدم'],
      ['login.connexion_operateur', 'Connexion Opérateur', 'Operator Login', 'Accesso Operatore', 'تسجيل دخول المشغل'],
      ['login.connexion_admin', 'Connexion Admin', 'Admin Login', 'Accesso Admin', 'تسجيل دخول المسؤول'],
      ['login.bienvenue', 'Bienvenue sur', 'Welcome to', 'Benvenuto su', 'مرحبًا بك في'],
      ['login.sous_titre', 'Système de suivi de production', 'Production tracking system', 'Sistema di monitoraggio produzione', 'نظام تتبع الإنتاج'],
      ['login.code_placeholder', '000000', '000000', '000000', '000000'],
      ['login.erreur_code', 'Code opérateur invalide', 'Invalid operator code', 'Codice operatore non valido', 'رمز المشغل غير صالح'],
      ['login.erreur_identifiants', 'Identifiants incorrects', 'Invalid credentials', 'Credenziali errate', 'بيانات الاعتماد غير صحيحة'],

      // Common extras
      ['common.erreur', 'Erreur', 'Error', 'Errore', 'خطأ'],
      ['common.succes', 'Succès', 'Success', 'Successo', 'نجاح'],
      ['common.retour', 'Retour', 'Back', 'Indietro', 'رجوع'],
      ['common.voir', 'Voir', 'View', 'Visualizza', 'عرض'],
      ['common.telecharger', 'Télécharger', 'Download', 'Scaricare', 'تحميل'],
      ['common.exporter', 'Exporter', 'Export', 'Esportare', 'تصدير'],
      ['common.enregistrer', 'Enregistrer', 'Save', 'Salvare', 'حفظ'],

      // Dashboard extras
      ['dashboard.production_jour', 'Production du Jour', 'Today\'s Production', 'Produzione del Giorno', 'إنتاج اليوم'],
      ['dashboard.pipeline', 'Pipeline de Production', 'Production Pipeline', 'Pipeline di Produzione', 'خط الإنتاج'],
      ['dashboard.activite_recente', 'Activité Récente', 'Recent Activity', 'Attività Recente', 'النشاط الأخير'],
      ['dashboard.aucune_activite', 'Aucune activité récente', 'No recent activity', 'Nessuna attività recente', 'لا يوجد نشاط حديث'],
      ['dashboard.taux_conformite', 'Taux de Conformité', 'Conformity Rate', 'Tasso di Conformità', 'معدل المطابقة'],
      ['dashboard.derniere_coulee', 'Dernière Coulée', 'Last Heat', 'Ultima Colata', 'آخر صبة'],
      ['dashboard.bobines_recentes', 'Bobines Récentes', 'Recent Coils', 'Bobine Recenti', 'البكرات الأخيرة'],
      ['dashboard.coulees_recentes', 'Coulées Récentes', 'Recent Heats', 'Colate Recenti', 'الصبات الأخيرة'],
      ['dashboard.il_y_a', 'il y a', 'ago', 'fa', 'منذ'],
      ['dashboard.secondes', 'secondes', 'seconds', 'secondi', 'ثوانٍ'],
      ['dashboard.minutes', 'minutes', 'minutes', 'minuti', 'دقائق'],
      ['dashboard.heures', 'heures', 'hours', 'ore', 'ساعات'],
      ['dashboard.jours', 'jours', 'days', 'giorni', 'أيام'],
      ['dashboard.a_linstant', "à l'instant", 'just now', 'adesso', 'الآن'],

      // Bobines extras
      ['bobines.epaisseur', 'Épaisseur', 'Thickness', 'Spessore', 'السمك'],
      ['bobines.largeur', 'Largeur', 'Width', 'Larghezza', 'العرض'],
      ['bobines.poids', 'Poids', 'Weight', 'Peso', 'الوزن'],
      ['bobines.fournisseur', 'Fournisseur', 'Supplier', 'Fornitore', 'المورد'],
      ['bobines.date_reception', 'Date Réception', 'Reception Date', 'Data Ricezione', 'تاريخ الاستلام'],
      ['bobines.en_stock', 'En Stock', 'In Stock', 'In Magazzino', 'في المخزون'],
      ['bobines.en_production', 'En Production', 'In Production', 'In Produzione', 'في الإنتاج'],
      ['bobines.consommee', 'Consommée', 'Consumed', 'Consumata', 'مستهلكة'],
      ['bobines.stats_total', 'Total Bobines', 'Total Coils', 'Totale Bobine', 'إجمالي البكرات'],
      ['bobines.stats_stock', 'En Stock', 'In Stock', 'In Magazzino', 'في المخزون'],
      ['bobines.stats_production', 'En Production', 'In Production', 'In Produzione', 'في الإنتاج'],
      ['bobines.stats_consommees', 'Consommées', 'Consumed', 'Consumate', 'مستهلكة'],
      ['bobines.rechercher', 'Rechercher une bobine...', 'Search for a coil...', 'Cerca una bobina...', 'البحث عن بكرة...'],
      ['bobines.toutes', 'Toutes', 'All', 'Tutte', 'الكل'],
      ['bobines.filtre_stock', 'En Stock', 'In Stock', 'In Magazzino', 'في المخزون'],
      ['bobines.filtre_production', 'En Production', 'In Production', 'In Produzione', 'في الإنتاج'],
      ['bobines.filtre_consommee', 'Consommée', 'Consumed', 'Consumata', 'مستهلكة'],
      ['bobines.aucune', 'Aucune bobine trouvée', 'No coils found', 'Nessuna bobina trovata', 'لم يتم العثور على بكرات'],
      ['bobines.modifier_bobine', 'Modifier la bobine', 'Edit coil', 'Modifica bobina', 'تعديل البكرة'],
      ['bobines.nouvelle_bobine', 'Nouvelle bobine', 'New coil', 'Nuova bobina', 'بكرة جديدة'],
      ['bobines.confirmer_suppression', 'Supprimer cette bobine ?', 'Delete this coil?', 'Eliminare questa bobina?', 'حذف هذه البكرة؟'],
      ['bobines.msg_creee', 'Bobine créée avec succès', 'Coil created successfully', 'Bobina creata con successo', 'تم إنشاء البكرة بنجاح'],
      ['bobines.msg_modifiee', 'Bobine modifiée avec succès', 'Coil updated successfully', 'Bobina modificata con successo', 'تم تعديل البكرة بنجاح'],
      ['bobines.msg_supprimee', 'Bobine supprimée avec succès', 'Coil deleted successfully', 'Bobina eliminata con successo', 'تم حذف البكرة بنجاح'],
      ['bobines.photos', 'Photos', 'Photos', 'Foto', 'صور'],
      ['bobines.ajouter_photo', 'Ajouter une photo', 'Add a photo', 'Aggiungi una foto', 'إضافة صورة'],
      ['bobines.detail', 'Détail Bobine', 'Coil Details', 'Dettaglio Bobina', 'تفاصيل البكرة'],
      ['bobines.pdf', 'Télécharger PDF', 'Download PDF', 'Scarica PDF', 'تحميل PDF'],
      ['bobines.qualite', 'Qualité', 'Quality', 'Qualità', 'الجودة'],
      ['bobines.observations', 'Observations', 'Observations', 'Osservazioni', 'ملاحظات'],
      ['bobines.mm', 'mm', 'mm', 'mm', 'مم'],
      ['bobines.kg', 'kg', 'kg', 'kg', 'كجم'],
      ['bobines.numero_coulee', 'N° Coulée', 'Heat No.', 'N° Colata', 'رقم الصبة'],

      // Coulées extras
      ['coulees.fournisseur', 'Fournisseur', 'Supplier', 'Fornitore', 'المورد'],
      ['coulees.grade_acier', 'Grade Acier', 'Steel Grade', 'Grado Acciaio', 'درجة الفولاذ'],
      ['coulees.date_reception', 'Date Réception', 'Reception Date', 'Data Ricezione', 'تاريخ الاستلام'],
      ['coulees.statut', 'Statut', 'Status', 'Stato', 'الحالة'],
      ['coulees.rechercher', 'Rechercher une coulée...', 'Search for a heat...', 'Cerca una colata...', 'البحث عن صبة...'],
      ['coulees.toutes', 'Toutes', 'All', 'Tutte', 'الكل'],
      ['coulees.aucune', 'Aucune coulée trouvée', 'No heats found', 'Nessuna colata trovata', 'لم يتم العثور على صبات'],
      ['coulees.reception', 'Réception', 'Reception', 'Ricezione', 'الاستلام'],
      ['coulees.installation', 'Installation', 'Installation', 'Installazione', 'التركيب'],
      ['coulees.checklist', 'Checklist', 'Checklist', 'Checklist', 'قائمة الفحص'],
      ['coulees.production', 'Production', 'Production', 'Produzione', 'الإنتاج'],
      ['coulees.terminee', 'Terminée', 'Completed', 'Completata', 'مكتملة'],
      ['coulees.nouvelle_coulee', 'Nouvelle coulée', 'New heat', 'Nuova colata', 'صبة جديدة'],
      ['coulees.modifier_coulee', 'Modifier la coulée', 'Edit heat', 'Modifica colata', 'تعديل الصبة'],
      ['coulees.confirmer_suppression', 'Supprimer cette coulée ?', 'Delete this heat?', 'Eliminare questa colata?', 'حذف هذه الصبة؟'],
      ['coulees.msg_creee', 'Coulée créée avec succès', 'Heat created successfully', 'Colata creata con successo', 'تم إنشاء الصبة بنجاح'],
      ['coulees.msg_modifiee', 'Coulée modifiée avec succès', 'Heat updated successfully', 'Colata modificata con successo', 'تم تعديل الصبة بنجاح'],
      ['coulees.msg_supprimee', 'Coulée supprimée avec succès', 'Heat deleted successfully', 'Colata eliminata con successo', 'تم حذف الصبة بنجاح'],
      ['coulees.detail', 'Détail Coulée', 'Heat Details', 'Dettaglio Colata', 'تفاصيل الصبة'],
      ['coulees.bobines_associees', 'Bobines Associées', 'Associated Coils', 'Bobine Associate', 'البكرات المرتبطة'],
      ['coulees.tubes_produits', 'Tubes Produits', 'Produced Tubes', 'Tubi Prodotti', 'الأنابيب المنتجة'],
      ['coulees.avancement', 'Avancement', 'Progress', 'Avanzamento', 'التقدم'],
      ['coulees.etape', 'Étape', 'Step', 'Fase', 'مرحلة'],
      ['coulees.stats_total', 'Total', 'Total', 'Totale', 'الإجمالي'],
      ['coulees.stats_actives', 'Actives', 'Active', 'Attive', 'نشطة'],
      ['coulees.stats_terminees', 'Terminées', 'Completed', 'Completate', 'مكتملة'],

      // Checklist
      ['checklist.titre', 'Checklist Machine', 'Machine Checklist', 'Checklist Macchina', 'قائمة فحص الآلة'],
      ['checklist.non_verifie', 'Non vérifié', 'Not verified', 'Non verificato', 'لم يتم التحقق'],
      ['checklist.conforme', 'Conforme', 'Compliant', 'Conforme', 'مطابق'],
      ['checklist.non_conforme', 'Non conforme', 'Non-compliant', 'Non conforme', 'غير مطابق'],
      ['checklist.corrige', 'Corrigé', 'Corrected', 'Corretto', 'تم التصحيح'],
      ['checklist.retour', 'Retour', 'Back', 'Indietro', 'رجوع'],
      ['checklist.btn_conforme', 'Conforme', 'Compliant', 'Conforme', 'مطابق'],
      ['checklist.btn_defaut', 'Défaut', 'Defect', 'Difetto', 'عيب'],
      ['checklist.corriger', 'Corriger', 'Correct', 'Correggere', 'تصحيح'],
      ['checklist.tout_valider', 'Tout valider', 'Validate all', 'Validare tutto', 'التحقق من الكل'],
      ['checklist.validee', 'Validée', 'Validated', 'Validata', 'تم التحقق'],
      ['checklist.critique', 'CRITIQUE', 'CRITICAL', 'CRITICO', 'حرج'],
      ['checklist.verifie_le', 'Vérifié le:', 'Verified on:', 'Verificato il:', 'تم التحقق في:'],
      ['checklist.par', 'Par:', 'By:', 'Da:', 'بواسطة:'],
      ['checklist.defaut_label', 'Défaut:', 'Defect:', 'Difetto:', 'العيب:'],
      ['checklist.correction_label', 'Correction:', 'Correction:', 'Correzione:', 'التصحيح:'],
      ['checklist.corrige_le', 'Corrigé le:', 'Corrected on:', 'Corretto il:', 'تم التصحيح في:'],
      ['checklist.chargement', 'Chargement de la checklist...', 'Loading checklist...', 'Caricamento checklist...', 'جاري تحميل قائمة الفحص...'],
      ['checklist.points_totaux', 'Points totaux', 'Total points', 'Punti totali', 'إجمالي النقاط'],
      ['checklist.conformes', 'Conformes', 'Compliant', 'Conformi', 'مطابقة'],
      ['checklist.non_conformes', 'Non conformes', 'Non-compliant', 'Non conformi', 'غير مطابقة'],
      ['checklist.corriges', 'Corrigés', 'Corrected', 'Corretti', 'تم تصحيحها'],
      ['checklist.non_verifies', 'Non vérifiés', 'Not verified', 'Non verificati', 'لم يتم التحقق منها'],
      ['checklist.validee_titre', 'Checklist Validée', 'Checklist Validated', 'Checklist Validata', 'تم التحقق من قائمة الفحص'],
      ['checklist.en_cours', 'En cours de validation', 'Validation in progress', 'Validazione in corso', 'جاري التحقق'],
      ['checklist.points_critiques', 'point(s) critique(s)', 'critical point(s)', 'punto/i critico/i', 'نقطة/نقاط حرجة'],
      ['checklist.points_controle', 'points de contrôle', 'checkpoints', 'punti di controllo', 'نقاط الفحص'],
      ['checklist.valider_checklist', 'Valider la Checklist Machine', 'Validate Machine Checklist', 'Validare la Checklist Macchina', 'التحقق من قائمة فحص الآلة'],
      ['checklist.retour_coulees', 'Retour aux Coulées - Démarrer la Production', 'Back to Heats - Start Production', 'Torna alle Colate - Avvia Produzione', 'العودة إلى الصبات - بدء الإنتاج'],
      ['checklist.signaler_defaut', 'Signaler un défaut', 'Report a defect', 'Segnalare un difetto', 'الإبلاغ عن عيب'],
      ['checklist.signaler_correction', 'Signaler une correction', 'Report a correction', 'Segnalare una correzione', 'الإبلاغ عن تصحيح'],
      ['checklist.defaut_detecte', 'Défaut détecté *', 'Detected defect *', 'Difetto rilevato *', 'عيب مكتشف *'],
      ['checklist.action_corrective', 'Action corrective', 'Corrective action', 'Azione correttiva', 'إجراء تصحيحي'],
      ['checklist.commentaire_additionnel', 'Commentaire additionnel', 'Additional comment', 'Commento aggiuntivo', 'تعليق إضافي'],
      ['checklist.placeholder_defaut', 'Décrivez le défaut constaté...', 'Describe the observed defect...', 'Descrivi il difetto riscontrato...', 'صف العيب الملاحظ...'],
      ['checklist.placeholder_correction', "Décrivez l'action corrective...", 'Describe the corrective action...', "Descrivi l'azione correttiva...", 'صف الإجراء التصحيحي...'],
      ['checklist.placeholder_commentaire', 'Commentaire optionnel...', 'Optional comment...', 'Commento opzionale...', 'تعليق اختياري...'],
      ['checklist.marquer_corrige', 'Marquer Corrigé', 'Mark Corrected', 'Contrassegna Corretto', 'وضع علامة تم التصحيح'],
      ['checklist.msg_validee', 'Checklist Machine validée avec succès!', 'Machine Checklist validated successfully!', 'Checklist Macchina validata con successo!', 'تم التحقق من قائمة فحص الآلة بنجاح!'],
      ['checklist.msg_section_validee', 'Tous les points de cette section sont déjà validés', 'All checkpoints in this section are already validated', 'Tutti i punti di questa sezione sono già validati', 'جميع نقاط هذا القسم تم التحقق منها بالفعل'],

      // Comptes
      ['comptes.titre', 'Gestion des Comptes', 'Account Management', 'Gestione Account', 'إدارة الحسابات'],
      ['comptes.nouveau', 'Nouveau Compte', 'New Account', 'Nuovo Account', 'حساب جديد'],
      ['comptes.rechercher', 'Rechercher un opérateur...', 'Search for an operator...', 'Cerca un operatore...', 'البحث عن مشغل...'],
      ['comptes.tous', 'Tous', 'All', 'Tutti', 'الكل'],
      ['comptes.operateurs', 'Opérateurs', 'Operators', 'Operatori', 'المشغلون'],
      ['comptes.admins', 'Admins', 'Admins', 'Amministratori', 'المسؤولون'],
      ['comptes.total', 'Total', 'Total', 'Totale', 'الإجمالي'],
      ['comptes.actifs', 'Actifs', 'Active', 'Attivi', 'نشطون'],
      ['comptes.operateur', 'Opérateur', 'Operator', 'Operatore', 'مشغل'],
      ['comptes.admin', 'Admin', 'Admin', 'Admin', 'مسؤول'],
      ['comptes.nom', 'Nom', 'Last Name', 'Cognome', 'الاسم'],
      ['comptes.prenom', 'Prénom', 'First Name', 'Nome', 'الاسم الأول'],
      ['comptes.code_operateur', 'Code Opérateur', 'Operator Code', 'Codice Operatore', 'رمز المشغل'],
      ['comptes.departement', 'Département', 'Department', 'Dipartimento', 'القسم'],
      ['comptes.qualification', 'Qualification', 'Qualification', 'Qualifica', 'المؤهل'],
      ['comptes.nom_utilisateur', "Nom d'utilisateur", 'Username', 'Nome utente', 'اسم المستخدم'],
      ['comptes.mot_de_passe', 'Mot de passe', 'Password', 'Password', 'كلمة المرور'],
      ['comptes.role', 'Rôle', 'Role', 'Ruolo', 'الدور'],
      ['comptes.creer', 'Créer', 'Create', 'Creare', 'إنشاء'],
      ['comptes.modifier', 'Modifier', 'Edit', 'Modificare', 'تعديل'],
      ['comptes.supprimer', 'Supprimer', 'Delete', 'Eliminare', 'حذف'],
      ['comptes.statut', 'Statut', 'Status', 'Stato', 'الحالة'],
      ['comptes.actif', 'Actif', 'Active', 'Attivo', 'نشط'],
      ['comptes.inactif', 'Inactif', 'Inactive', 'Inattivo', 'غير نشط'],
      ['comptes.actions', 'Actions', 'Actions', 'Azioni', 'إجراءات'],
      ['comptes.promouvoir_admin', 'Promouvoir Admin', 'Promote to Admin', 'Promuovere Admin', 'ترقية إلى مسؤول'],
      ['comptes.revoquer_admin', 'Révoquer Admin', 'Revoke Admin', 'Revocare Admin', 'إلغاء صلاحية المسؤول'],
      ['comptes.generer_code', 'Générer Code', 'Generate Code', 'Generare Codice', 'إنشاء رمز'],
      ['comptes.msg_code_genere', 'Code généré avec succès', 'Code generated successfully', 'Codice generato con successo', 'تم إنشاء الرمز بنجاح'],
      ['comptes.msg_compte_cree', 'Compte créé avec succès', 'Account created successfully', 'Account creato con successo', 'تم إنشاء الحساب بنجاح'],
      ['comptes.msg_compte_modifie', 'Compte modifié avec succès', 'Account updated successfully', 'Account modificato con successo', 'تم تعديل الحساب بنجاح'],
      ['comptes.msg_compte_supprime', 'Compte supprimé avec succès', 'Account deleted successfully', 'Account eliminato con successo', 'تم حذف الحساب بنجاح'],
      ['comptes.aucun_operateur', 'Aucun opérateur trouvé', 'No operator found', 'Nessun operatore trovato', 'لم يتم العثور على مشغل'],
      ['comptes.modifier_compte', 'Modifier le compte', 'Edit account', 'Modifica account', 'تعديل الحساب'],
      ['comptes.nouveau_compte', 'Nouveau compte', 'New account', 'Nuovo account', 'حساب جديد'],
      ['comptes.confirmer_suppression', 'Êtes-vous sûr de vouloir supprimer', 'Are you sure you want to delete', 'Sei sicuro di voler eliminare', 'هل أنت متأكد من الحذف'],
      ['comptes.action_irreversible', 'Cette action est irréversible', 'This action is irreversible', 'Questa azione è irreversibile', 'هذا الإجراء لا يمكن التراجع عنه'],

      // Departments
      ['dept.production', 'Production', 'Production', 'Produzione', 'الإنتاج'],
      ['dept.qualite', 'Qualité', 'Quality', 'Qualità', 'الجودة'],
      ['dept.maintenance', 'Maintenance', 'Maintenance', 'Manutenzione', 'الصيانة'],
      ['dept.logistique', 'Logistique', 'Logistics', 'Logistica', 'اللوجستيات'],
      ['dept.magasin', 'Magasin', 'Warehouse', 'Magazzino', 'المخزن'],
      ['dept.administration', 'Administration', 'Administration', 'Amministrazione', 'الإدارة'],

      // Qualifications
      ['qualif.soudeur', 'Soudeur', 'Welder', 'Saldatore', 'لحّام'],
      ['qualif.operateur_machine', 'Opérateur Machine', 'Machine Operator', 'Operatore Macchina', 'مشغل آلة'],
      ['qualif.chef_equipe', "Chef d'équipe", 'Team Leader', 'Capo Squadra', 'رئيس فريق'],
      ['qualif.technicien', 'Technicien', 'Technician', 'Tecnico', 'فني'],
      ['qualif.ingenieur', 'Ingénieur', 'Engineer', 'Ingegnere', 'مهندس'],
      ['qualif.inspecteur', 'Inspecteur Qualité', 'Quality Inspector', 'Ispettore Qualità', 'مفتش جودة'],

      // Postes
      ['poste.matin', 'Matin', 'Morning', 'Mattina', 'صباحي'],
      ['poste.apres_midi', 'Après-midi', 'Afternoon', 'Pomeriggio', 'مسائي'],
      ['poste.nuit', 'Nuit', 'Night', 'Notte', 'ليلي'],

      // Equipes
      ['equipe.a', 'Équipe A', 'Team A', 'Squadra A', 'الفريق أ'],
      ['equipe.b', 'Équipe B', 'Team B', 'Squadra B', 'الفريق ب'],
      ['equipe.c', 'Équipe C', 'Team C', 'Squadra C', 'الفريق ج'],

      // Navigation extras
      ['nav.gestion_comptes', 'Gestion des Comptes', 'Account Management', 'Gestione Account', 'إدارة الحسابات'],
    ];

    let inserted = 0;
    let updated = 0;
    const langCodes = ['fr', 'en', 'it', 'ar'];

    for (const [cle, ...values] of translations) {
      for (let i = 0; i < langCodes.length; i++) {
        const [result] = await conn.execute(
          `INSERT INTO traductions (langue_code, cle, valeur)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE valeur = IF(valeur = cle, VALUES(valeur), valeur)`,
          [langCodes[i], cle, values[i]]
        );
        if (result.affectedRows === 1) inserted++;
        else if (result.affectedRows === 2) updated++;
      }
    }

    console.log(`✅ Traductions extra: ${inserted} insérées, ${updated} mises à jour`);

    // Verify total count
    const [counts] = await conn.execute(
      'SELECT langue_code, COUNT(*) as cnt FROM traductions GROUP BY langue_code'
    );
    console.log('📊 Traductions par langue:');
    counts.forEach(r => console.log(`   ${r.langue_code}: ${r.cnt} clés`));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrateExtraTranslations();
