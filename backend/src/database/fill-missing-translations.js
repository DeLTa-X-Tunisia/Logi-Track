const mysql = require('mysql2/promise');

async function fillMissingTranslations() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'logitrack', charset: 'utf8mb4'
  });
  await conn.execute("SET NAMES 'utf8mb4'");

  // 13 keys missing in FR/EN/IT (already exist in AR)
  const translations = [
    // [key, fr, en, it, ar]
    ['coulees.confirmer_demarrage', 'Confirmer le démarrage', 'Confirm start', 'Conferma avvio', 'تأكيد البدء'],
    ['coulees.date_creation', 'Date Création', 'Creation Date', 'Data Creazione', 'تاريخ الإنشاء'],
    ['coulees.delete_confirm', 'Êtes-vous sûr de vouloir supprimer cette coulée ?', 'Are you sure you want to delete this heat?', 'Sei sicuro di voler eliminare questa colata?', 'هل أنت متأكد من حذف هذه الصبة؟'],
    ['coulees.delete_title', 'Supprimer la coulée', 'Delete Heat', 'Elimina Colata', 'حذف الصبة'],
    ['coulees.delete_warning', 'Cette action est irréversible', 'This action is irreversible', 'Questa azione è irreversibile', 'هذا الإجراء لا يمكن التراجع عنه'],
    ['coulees.etape_actuelle', 'Étape actuelle', 'Current Step', 'Fase attuale', 'المرحلة الحالية'],
    ['coulees.msg_retard', 'Retard signalé avec succès', 'Delay reported successfully', 'Ritardo segnalato con successo', 'تم تسجيل التأخير بنجاح'],
    ['coulees.nombre_bobines', 'Nombre de bobines', 'Number of coils', 'Numero di bobine', 'عدد البكرات'],
    ['coulees.poids_total', 'Poids total', 'Total weight', 'Peso totale', 'الوزن الإجمالي'],
    ['coulees.raison_retard', 'Raison du retard', 'Delay reason', 'Motivo del ritardo', 'سبب التأخير'],
    ['coulees.retard', 'Retard', 'Delay', 'Ritardo', 'تأخير'],
    ['dashboard.consommees', 'Consommées', 'Consumed', 'Consumate', 'مستهلكة'],
    ['dashboard.en_cours', 'En cours', 'In progress', 'In corso', 'قيد التنفيذ'],
  ];

  const langs = ['fr', 'en', 'it', 'ar'];
  let inserted = 0, updated = 0;

  for (const [cle, ...values] of translations) {
    for (let i = 0; i < 4; i++) {
      const [result] = await conn.execute(
        'INSERT INTO traductions (langue_code, cle, valeur) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)',
        [langs[i], cle, values[i]]
      );
      if (result.affectedRows === 1) inserted++;
      else if (result.affectedRows === 2) updated++;
    }
  }

  console.log(`✅ ${inserted} insérées, ${updated} mises à jour`);

  // Final verification - any remaining gaps?
  const [gaps] = await conn.execute(`
    SELECT t1.cle,
      MAX(CASE WHEN t1.langue_code='fr' THEN 'OK' END) as fr,
      MAX(CASE WHEN t1.langue_code='en' THEN 'OK' END) as en,
      MAX(CASE WHEN t1.langue_code='it' THEN 'OK' END) as it,
      MAX(CASE WHEN t1.langue_code='ar' THEN 'OK' END) as ar
    FROM traductions t1
    GROUP BY t1.cle
    HAVING fr IS NULL OR en IS NULL OR it IS NULL OR ar IS NULL
    ORDER BY t1.cle
  `);

  if (gaps.length === 0) {
    console.log('✅ Toutes les traductions sont complètes dans les 4 langues !');
  } else {
    console.log(`⚠️ ${gaps.length} clés encore incomplètes:`);
    gaps.forEach(g => console.log(`  ${g.cle} → FR:${g.fr||'MISS'} EN:${g.en||'MISS'} IT:${g.it||'MISS'} AR:${g.ar||'MISS'}`));
  }

  // Count per language
  const [counts] = await conn.execute('SELECT langue_code, COUNT(*) as cnt FROM traductions GROUP BY langue_code');
  console.log('📊 Totaux:');
  counts.forEach(r => console.log(`   ${r.langue_code}: ${r.cnt} clés`));

  await conn.end();
  process.exit(0);
}

fillMissingTranslations();
