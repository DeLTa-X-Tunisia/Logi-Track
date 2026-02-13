const mysql = require('mysql2/promise');

async function fixArabicTranslations() {
  // Create a dedicated connection with explicit utf8mb4
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'logitrack',
    charset: 'utf8mb4',
  });

  // Force charset on the session
  await conn.execute("SET NAMES 'utf8mb4'");
  await conn.execute("SET CHARACTER SET utf8mb4");

  const arTranslations = {
    // Navigation
    'nav.dashboard': 'لوحة القيادة',
    'nav.bobines': 'البكرات',
    'nav.parametres_prod': 'إعدادات الإنتاج',
    'nav.coulees': 'الصهرات',
    'nav.checklist_machine': 'قائمة فحص الآلة',
    'nav.tubes': 'الأنابيب',
    'nav.checklists_generales': 'قوائم الفحص العامة',
    'nav.debut_quart': 'بداية الوردية',
    'nav.hebdomadaire': 'أسبوعي',
    'nav.mensuelle': 'شهري',
    'nav.etapes_production': 'مراحل الإنتاج',
    'nav.administration': 'الإدارة',
    'nav.logitracker': 'LogiTracker',
    'nav.parametres_projet': 'إعدادات المشروع',
    'nav.parametres_langue': 'إعدادات اللغة',
    'nav.gestion_comptes': 'إدارة الحسابات',

    // Header
    'header.parametres': 'الإعدادات',
    'header.deconnexion': 'تسجيل الخروج',
    'header.langue': 'اللغة',
    'header.certification': 'شهادة API 5L',
    'header.version': 'الإصدار 1.0.0',

    // Common
    'common.sauvegarder': 'حفظ',
    'common.annuler': 'إلغاء',
    'common.supprimer': 'حذف',
    'common.modifier': 'تعديل',
    'common.ajouter': 'إضافة',
    'common.rechercher': 'بحث...',
    'common.confirmer': 'تأكيد',
    'common.fermer': 'إغلاق',
    'common.oui': 'نعم',
    'common.non': 'لا',
    'common.chargement': 'جاري التحميل...',
    'common.aucun_resultat': 'لا توجد نتائج',
    'common.actions': 'إجراءات',
    'common.statut': 'الحالة',
    'common.date': 'التاريخ',
    'common.nom': 'الاسم',
    'common.description': 'الوصف',
    'common.type': 'النوع',
    'common.total': 'الإجمالي',
    'common.erreur': 'خطأ',
    'common.succes': 'نجاح',
    'common.retour': 'رجوع',
    'common.voir': 'عرض',
    'common.telecharger': 'تحميل',
    'common.exporter': 'تصدير',
    'common.enregistrer': 'حفظ',

    // Login
    'login.titre': 'تسجيل الدخول',
    'login.mot_de_passe': 'كلمة المرور',
    'login.se_connecter': 'تسجيل الدخول',
    'login.code_operateur': 'رمز المشغل',
    'login.titre_operateur': 'مشغل',
    'login.titre_admin': 'إدارة',
    'login.entrer_code': 'أدخل رمزك المكون من 6 أرقام',
    'login.identifiant': 'اسم المستخدم',
    'login.connexion_operateur': 'تسجيل دخول المشغل',
    'login.connexion_admin': 'تسجيل دخول المسؤول',
    'login.bienvenue': 'مرحبًا بك في',
    'login.sous_titre': 'نظام تتبع الإنتاج',
    'login.code_placeholder': '000000',
    'login.erreur_code': 'رمز المشغل غير صالح',
    'login.erreur_identifiants': 'بيانات الاعتماد غير صحيحة',

    // Footer
    'footer.credit': 'تمت البرمجة بـ ❤️ بواسطة',

    // Dashboard
    'dashboard.titre': 'لوحة القيادة',
    'dashboard.vue_ensemble': 'نظرة عامة على الإنتاج',
    'dashboard.actualiser': 'تحديث',
    'dashboard.tubes_en_cours': 'أنابيب قيد التنفيذ',
    'dashboard.tubes_termines': 'الأنابيب المكتملة',
    'dashboard.rebuts': 'المرفوضات',
    'dashboard.total_tubes': 'إجمالي الأنابيب',
    'dashboard.crees_aujourdhui': 'أُنشئت اليوم',
    'dashboard.aujourdhui': 'اليوم',
    'dashboard.taux_rebut': 'معدل الرفض',
    'dashboard.en_reparation': 'قيد الإصلاح',
    'dashboard.pipeline': 'خط إنتاج API 5L',
    'dashboard.bobines': 'البكرات',
    'dashboard.coulees': 'الصهرات',
    'dashboard.voir_tout': 'عرض الكل',
    'dashboard.en_stock': 'في المخزون',
    'dashboard.en_production': 'في الإنتاج',
    'dashboard.consommees': 'مستهلكة',
    'dashboard.en_cours': 'قيد التنفيذ',
    'dashboard.pretes': 'جاهزة',
    'dashboard.activite_recente': 'النشاط الأخير',
    'dashboard.aucune_activite': 'لا يوجد نشاط حديث',
    'dashboard.erreur_chargement': 'خطأ في تحميل البيانات',
    'dashboard.reessayer': 'إعادة المحاولة',
    'dashboard.a_linstant': 'الآن',
    'dashboard.il_y_a_min': 'منذ {n} دقيقة',
    'dashboard.il_y_a_h': 'منذ {n} ساعة',
    'dashboard.il_y_a_j': 'منذ {n} يوم',
    'dashboard.production_jour': 'إنتاج اليوم',
    'dashboard.tubes_produits': 'الأنابيب المنتجة',
    'dashboard.bobines_stock': 'البكرات في المخزون',
    'dashboard.coulees_actives': 'الصهرات النشطة',
    'dashboard.taux_conformite': 'معدل المطابقة',
    'dashboard.derniere_coulee': 'آخر صبة',
    'dashboard.bobines_recentes': 'البكرات الأخيرة',
    'dashboard.coulees_recentes': 'الصبات الأخيرة',
    'dashboard.il_y_a': 'منذ',
    'dashboard.secondes': 'ثوانٍ',
    'dashboard.minutes': 'دقائق',
    'dashboard.heures': 'ساعات',
    'dashboard.jours': 'أيام',

    // Étapes de production (Pipeline)
    'etape.FORMAGE': 'التشكيل',
    'etape.POINTAGE': 'اللحام النقطي (GMAW)',
    'etape.CV_POINTAGE': 'فحص بصري للحام النقطي',
    'etape.SAW_ID_OD': 'SAW ID/OD',
    'etape.CV_CORDON': 'فحص بصري لخط اللحام',
    'etape.COUPE': 'القطع',
    'etape.CND': 'الاختبار غير الإتلافي (أشعة/UT)',
    'etape.CV_APRES_CND': 'فحص بصري بعد الاختبار',
    'etape.HYDROTEST': 'اختبار هيدروستاتيكي',
    'etape.CV_FUITE': 'فحص التسرب/التشوه',
    'etape.CHANFREIN': 'الشطف',
    'etape.CV_CHANFREIN': 'فحص بصري للشطف',

    // Bobines
    'bobines.titre': 'إدارة البكرات',
    'bobines.nouvelle': 'بكرة جديدة',
    'bobines.numero': 'رقم البكرة',
    'bobines.epaisseur': 'السمك',
    'bobines.largeur': 'العرض',
    'bobines.poids': 'الوزن',
    'bobines.fournisseur': 'المورد',
    'bobines.date_reception': 'تاريخ الاستلام',
    'bobines.en_stock': 'في المخزون',
    'bobines.en_production': 'في الإنتاج',
    'bobines.consommee': 'مستهلكة',
    'bobines.stats_total': 'إجمالي البكرات',
    'bobines.stats_stock': 'في المخزون',
    'bobines.stats_production': 'في الإنتاج',
    'bobines.stats_consommees': 'مستهلكة',
    'bobines.rechercher': 'البحث عن بكرة...',
    'bobines.toutes': 'الكل',
    'bobines.filtre_stock': 'في المخزون',
    'bobines.filtre_production': 'في الإنتاج',
    'bobines.filtre_consommee': 'مستهلكة',
    'bobines.aucune': 'لم يتم العثور على بكرات',
    'bobines.modifier_bobine': 'تعديل البكرة',
    'bobines.nouvelle_bobine': 'بكرة جديدة',
    'bobines.confirmer_suppression': 'حذف هذه البكرة؟',
    'bobines.msg_creee': 'تم إنشاء البكرة بنجاح',
    'bobines.msg_modifiee': 'تم تعديل البكرة بنجاح',
    'bobines.msg_supprimee': 'تم حذف البكرة بنجاح',
    'bobines.photos': 'صور',
    'bobines.ajouter_photo': 'إضافة صورة',
    'bobines.detail': 'تفاصيل البكرة',
    'bobines.pdf': 'تحميل PDF',
    'bobines.qualite': 'الجودة',
    'bobines.observations': 'ملاحظات',
    'bobines.mm': 'مم',
    'bobines.kg': 'كجم',
    'bobines.numero_coulee': 'رقم الصبة',

    // Coulées
    'coulees.titre': 'إدارة الصهرات',
    'coulees.nouvelle': 'صبة جديدة',
    'coulees.fournisseur': 'المورد',
    'coulees.grade_acier': 'درجة الفولاذ',
    'coulees.date_reception': 'تاريخ الاستلام',
    'coulees.statut': 'الحالة',
    'coulees.rechercher': 'البحث عن صبة...',
    'coulees.toutes': 'الكل',
    'coulees.aucune': 'لم يتم العثور على صبات',
    'coulees.reception': 'الاستلام',
    'coulees.installation': 'التركيب',
    'coulees.checklist': 'قائمة الفحص',
    'coulees.production': 'الإنتاج',
    'coulees.terminee': 'مكتملة',
    'coulees.nouvelle_coulee': 'صبة جديدة',
    'coulees.modifier_coulee': 'تعديل الصبة',
    'coulees.confirmer_suppression': 'حذف هذه الصبة؟',
    'coulees.msg_creee': 'تم إنشاء الصبة بنجاح',
    'coulees.msg_modifiee': 'تم تعديل الصبة بنجاح',
    'coulees.msg_supprimee': 'تم حذف الصبة بنجاح',
    'coulees.detail': 'تفاصيل الصبة',
    'coulees.bobines_associees': 'البكرات المرتبطة',
    'coulees.tubes_produits': 'الأنابيب المنتجة',
    'coulees.avancement': 'التقدم',
    'coulees.etape': 'مرحلة',
    'coulees.stats_total': 'الإجمالي',
    'coulees.stats_actives': 'نشطة',
    'coulees.stats_terminees': 'مكتملة',
    'coulees.numero': 'رقم الصبة',
    'coulees.nombre_bobines': 'عدد البكرات',
    'coulees.poids_total': 'الوزن الإجمالي',
    'coulees.date_creation': 'تاريخ الإنشاء',
    'coulees.etape_actuelle': 'المرحلة الحالية',
    'coulees.demarrer_production': 'بدء الإنتاج',
    'coulees.confirmer_demarrage': 'تأكيد البدء',
    'coulees.retard': 'تأخير',
    'coulees.msg_retard': 'تأخير مسجل',
    'coulees.raison_retard': 'سبب التأخير',
    'coulees.delete_title': 'حذف الصبة',
    'coulees.delete_confirm': 'هل أنت متأكد من حذف هذه الصبة؟',
    'coulees.delete_warning': 'هذا الإجراء لا يمكن التراجع عنه',

    // Checklist
    'checklist.titre': 'قائمة فحص الآلة',
    'checklist.non_verifie': 'لم يتم التحقق',
    'checklist.conforme': 'مطابق',
    'checklist.non_conforme': 'غير مطابق',
    'checklist.corrige': 'تم التصحيح',
    'checklist.retour': 'رجوع',
    'checklist.btn_conforme': 'مطابق',
    'checklist.btn_defaut': 'عيب',
    'checklist.corriger': 'تصحيح',
    'checklist.tout_valider': 'التحقق من الكل',
    'checklist.validee': 'تم التحقق',
    'checklist.critique': 'حرج',
    'checklist.verifie_le': 'تم التحقق في:',
    'checklist.par': 'بواسطة:',
    'checklist.defaut_label': 'العيب:',
    'checklist.correction_label': 'التصحيح:',
    'checklist.corrige_le': 'تم التصحيح في:',
    'checklist.chargement': 'جاري تحميل قائمة الفحص...',
    'checklist.points_totaux': 'إجمالي النقاط',
    'checklist.conformes': 'مطابقة',
    'checklist.non_conformes': 'غير مطابقة',
    'checklist.corriges': 'تم تصحيحها',
    'checklist.non_verifies': 'لم يتم التحقق منها',
    'checklist.validee_titre': 'تم التحقق من قائمة الفحص',
    'checklist.en_cours': 'جاري التحقق',
    'checklist.points_critiques': 'نقطة/نقاط حرجة',
    'checklist.points_controle': 'نقاط الفحص',
    'checklist.valider_checklist': 'التحقق من قائمة فحص الآلة',
    'checklist.retour_coulees': 'العودة إلى الصبات - بدء الإنتاج',
    'checklist.signaler_defaut': 'الإبلاغ عن عيب',
    'checklist.signaler_correction': 'الإبلاغ عن تصحيح',
    'checklist.defaut_detecte': 'عيب مكتشف *',
    'checklist.action_corrective': 'إجراء تصحيحي',
    'checklist.commentaire_additionnel': 'تعليق إضافي',
    'checklist.placeholder_defaut': 'صف العيب الملاحظ...',
    'checklist.placeholder_correction': 'صف الإجراء التصحيحي...',
    'checklist.placeholder_commentaire': 'تعليق اختياري...',
    'checklist.marquer_corrige': 'وضع علامة تم التصحيح',
    'checklist.msg_validee': 'تم التحقق من قائمة فحص الآلة بنجاح!',
    'checklist.msg_section_validee': 'جميع نقاط هذا القسم تم التحقق منها بالفعل',

    // Comptes
    'comptes.titre': 'إدارة الحسابات',
    'comptes.nouveau': 'حساب جديد',
    'comptes.rechercher': 'البحث عن مشغل...',
    'comptes.tous': 'الكل',
    'comptes.operateurs': 'المشغلون',
    'comptes.admins': 'المسؤولون',
    'comptes.total': 'الإجمالي',
    'comptes.actifs': 'نشطون',
    'comptes.operateur': 'مشغل',
    'comptes.admin': 'مسؤول',
    'comptes.nom': 'الاسم',
    'comptes.prenom': 'الاسم الأول',
    'comptes.code_operateur': 'رمز المشغل',
    'comptes.departement': 'القسم',
    'comptes.qualification': 'المؤهل',
    'comptes.nom_utilisateur': 'اسم المستخدم',
    'comptes.mot_de_passe': 'كلمة المرور',
    'comptes.role': 'الدور',
    'comptes.creer': 'إنشاء',
    'comptes.modifier': 'تعديل',
    'comptes.supprimer': 'حذف',
    'comptes.statut': 'الحالة',
    'comptes.actif': 'نشط',
    'comptes.inactif': 'غير نشط',
    'comptes.actions': 'إجراءات',
    'comptes.promouvoir_admin': 'ترقية إلى مسؤول',
    'comptes.revoquer_admin': 'إلغاء صلاحية المسؤول',
    'comptes.generer_code': 'إنشاء رمز',
    'comptes.msg_code_genere': 'تم إنشاء الرمز بنجاح',
    'comptes.msg_compte_cree': 'تم إنشاء الحساب بنجاح',
    'comptes.msg_compte_modifie': 'تم تعديل الحساب بنجاح',
    'comptes.msg_compte_supprime': 'تم حذف الحساب بنجاح',
    'comptes.aucun_operateur': 'لم يتم العثور على مشغل',
    'comptes.modifier_compte': 'تعديل الحساب',
    'comptes.nouveau_compte': 'حساب جديد',
    'comptes.confirmer_suppression': 'هل أنت متأكد من الحذف',
    'comptes.action_irreversible': 'هذا الإجراء لا يمكن التراجع عنه',

    // Departments
    'dept.production': 'الإنتاج',
    'dept.qualite': 'الجودة',
    'dept.maintenance': 'الصيانة',
    'dept.logistique': 'اللوجستيات',
    'dept.magasin': 'المخزن',
    'dept.administration': 'الإدارة',

    // Qualifications
    'qualif.soudeur': 'لحّام',
    'qualif.operateur_machine': 'مشغل آلة',
    'qualif.chef_equipe': 'رئيس فريق',
    'qualif.technicien': 'فني',
    'qualif.ingenieur': 'مهندس',
    'qualif.inspecteur': 'مفتش جودة',

    // Postes
    'poste.matin': 'صباحي',
    'poste.apres_midi': 'مسائي',
    'poste.nuit': 'ليلي',

    // Equipes
    'equipe.a': 'الفريق أ',
    'equipe.b': 'الفريق ب',
    'equipe.c': 'الفريق ج',

    // Langue settings
    'langue.titre': 'إعدادات اللغة',
    'langue.description': 'إدارة لغات وترجمات التطبيق',
    'langue.langues_disponibles': 'اللغات المتاحة',
    'langue.par_defaut': 'افتراضي',
    'langue.traductions': 'الترجمات',

    // Messages
    'msg.succes_sauvegarde': 'تم الحفظ بنجاح',
    'msg.erreur_serveur': 'خطأ في الخادم',
    'msg.confirmer_suppression': 'هل أنت متأكد من الحذف؟',
  };

  try {
    let updated = 0;
    let inserted = 0;

    for (const [cle, valeur] of Object.entries(arTranslations)) {
      const [result] = await conn.execute(
        `INSERT INTO traductions (langue_code, cle, valeur)
         VALUES ('ar', ?, ?)
         ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
        [cle, valeur]
      );
      if (result.affectedRows === 1) inserted++;
      else if (result.affectedRows === 2) updated++;
    }

    console.log(`✅ Traductions arabes corrigées: ${inserted} insérées, ${updated} mises à jour`);

    // Verify
    const [check] = await conn.execute(
      "SELECT cle, valeur, HEX(SUBSTRING(valeur,1,4)) as hex4 FROM traductions WHERE langue_code='ar' AND cle='etape.FORMAGE'"
    );
    console.log('🔍 Vérification etape.FORMAGE:', check[0]?.valeur, '| HEX:', check[0]?.hex4);

    const [count] = await conn.execute(
      "SELECT COUNT(*) as cnt FROM traductions WHERE langue_code='ar'"
    );
    console.log(`📊 Total traductions arabes: ${count[0].cnt}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

fixArabicTranslations();
