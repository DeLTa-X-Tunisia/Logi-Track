/**
 * Génération de PDF pour les checklists périodiques
 * Utilise jsPDF + jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
  primary: [37, 99, 235],      // blue-600
  success: [22, 163, 74],      // green-600
  danger: [220, 38, 38],       // red-600
  warning: [217, 119, 6],      // amber-600
  gray: [107, 114, 128],       // gray-500
  darkGray: [55, 65, 81],      // gray-700
  lightGray: [243, 244, 246],  // gray-100
  white: [255, 255, 255],
  black: [17, 24, 39],         // gray-900
};

const STATUT_LABELS = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  corrige: 'Corrigé',
  non_verifie: 'Non vérifié',
};

const STATUT_COLORS = {
  conforme: COLORS.success,
  non_conforme: COLORS.danger,
  corrige: COLORS.warning,
  non_verifie: COLORS.gray,
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function generateChecklistPdf(session, categories, stats) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── HEADER ───
  // Bandeau supérieur
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text('LogiTrack', margin, 13);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(session.type_nom || 'Checklist', margin, 22);

  // Session info (droite)
  doc.setFontSize(9);
  doc.text(`Session #${session.id}`, pageWidth - margin, 13, { align: 'right' });
  doc.text(formatDate(session.created_at), pageWidth - margin, 22, { align: 'right' });

  y = 40;

  // ─── INFOS GÉNÉRALES ───
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.darkGray);
  doc.setFont('helvetica', 'bold');

  const col1 = margin + 5;
  const col2 = margin + contentWidth / 3;
  const col3 = margin + (contentWidth * 2) / 3;

  doc.text('Opérateur', col1, y + 7);
  doc.text('Fréquence', col2, y + 7);
  doc.text('Statut', col3, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);

  const operateurText = session.operateur_nom?.trim() || '—';
  const matriculeText = session.operateur_matricule ? ` (${session.operateur_matricule})` : '';
  doc.text(`${operateurText}${matriculeText}`, col1, y + 14);

  doc.text(session.frequence || '—', col2, y + 14);

  // Statut badge
  const estExpiree = session.date_expiration && new Date(session.date_expiration) < new Date();
  const statutColor = session.statut === 'validee' ? (estExpiree ? COLORS.warning : COLORS.success) : (estExpiree ? COLORS.danger : COLORS.warning);
  const statutText = session.statut === 'validee' ? (estExpiree ? 'Validée (expirée)' : 'Validée') : (estExpiree ? 'Expirée' : 'En cours');
  doc.setTextColor(...statutColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statutText, col3, y + 14);

  // Ligne 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.darkGray);
  doc.text('Date validation', col1, y + 21);
  doc.text('Échéance', col2, y + 21);
  doc.text('Durée', col3, y + 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(session.date_validation ? formatDate(session.date_validation) : '—', col1, y + 27);
  doc.text(session.date_expiration ? formatDate(session.date_expiration) : '—', col2, y + 27);
  
  if (session.date_validation && session.created_at) {
    const mins = Math.round((new Date(session.date_validation) - new Date(session.created_at)) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    doc.text(h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`, col3, y + 27);
  } else {
    doc.text('—', col3, y + 27);
  }

  y += 35;

  // ─── STATS RÉSUMÉ ───
  const statBoxW = contentWidth / 5;
  const statItems = [
    { label: 'Total', value: stats.total, color: COLORS.gray },
    { label: 'Conformes', value: stats.conformes, color: COLORS.success },
    { label: 'Non conformes', value: stats.non_conformes, color: COLORS.danger },
    { label: 'Corrigés', value: stats.corriges, color: COLORS.warning },
    { label: 'Non vérifiés', value: stats.non_verifies, color: COLORS.gray },
  ];

  statItems.forEach((stat, i) => {
    const x = margin + i * statBoxW;
    doc.setFillColor(stat.color[0], stat.color[1], stat.color[2], 0.1);
    doc.setDrawColor(...stat.color);
    doc.setLineWidth(0.3);
    doc.roundedRect(x + 1, y, statBoxW - 2, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...stat.color);
    doc.text(String(stat.value), x + statBoxW / 2, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(stat.label, x + statBoxW / 2, y + 14, { align: 'center' });
  });

  y += 22;

  // Barre de progression
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, y, contentWidth, 4, 2, 2, 'F');
  const progWidth = (stats.progression / 100) * contentWidth;
  if (progWidth > 0) {
    const progColor = stats.progression === 100 ? COLORS.success : COLORS.primary;
    doc.setFillColor(...progColor);
    doc.roundedRect(margin, y, Math.max(progWidth, 4), 4, 2, 2, 'F');
  }
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.primary);
  doc.text(`${stats.progression}%`, pageWidth - margin, y + 3, { align: 'right' });

  y += 10;

  // ─── TABLEAU DES ITEMS PAR CATÉGORIE ───
  categories.forEach((category) => {
    // Vérifier s'il faut sauter de page
    const estimatedHeight = 12 + category.items.length * 8;
    if (y + estimatedHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }

    // En-tête catégorie
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.white);

    const catDone = category.items.filter(it => it.validation && it.validation.statut !== 'non_verifie').length;
    doc.text(`${category.nom}  (${catDone}/${category.items.length})`, margin + 4, y + 5.5);
    y += 10;

    // Tableau des items
    const tableData = category.items.map(item => {
      const v = item.validation;
      const statut = v ? v.statut : 'non_verifie';
      const statutLabel = STATUT_LABELS[statut] || statut;
      const critique = item.critique ? 'OUI' : '';
      const heure = v?.date_verification ? formatTime(v.date_verification) : '';
      const valideur = v?.valideur || '';
      const defaut = v?.defaut_detecte || '';
      const action = v?.action_corrective || '';

      return [item.libelle, critique, statutLabel, heure, valideur, defaut, action];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Point de contrôle', 'Crit.', 'Statut', 'Heure', 'Valideur', 'Défaut', 'Action corrective']],
      body: tableData,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.5,
        lineColor: [229, 231, 235],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [249, 250, 251],
        textColor: COLORS.darkGray,
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 22 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
      },
      didParseCell: (data) => {
        // Colorer le statut
        if (data.section === 'body' && data.column.index === 2) {
          const statusText = data.cell.raw;
          if (statusText === 'Conforme') data.cell.styles.textColor = COLORS.success;
          else if (statusText === 'Non conforme') data.cell.styles.textColor = COLORS.danger;
          else if (statusText === 'Corrigé') data.cell.styles.textColor = COLORS.warning;
          else data.cell.styles.textColor = COLORS.gray;

          data.cell.styles.fontStyle = 'bold';
        }
        // Critique en rouge
        if (data.section === 'body' && data.column.index === 1 && data.cell.raw === 'OUI') {
          data.cell.styles.textColor = COLORS.danger;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      theme: 'grid',
    });

    y = doc.lastAutoTable.finalY + 6;
  });

  // ─── PIED DE PAGE ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();

    // Ligne de séparation
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageWidth - margin, pageH - 12);

    // Footer texte
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.gray);
    doc.text(`LogiTrack — ${session.type_nom} — Session #${session.id}`, margin, pageH - 7);
    doc.text(`Page ${i}/${pageCount}`, pageWidth - margin, pageH - 7, { align: 'right' });
    doc.text('Coded with ❤ by Azizi Mounir', pageWidth / 2, pageH - 7, { align: 'center' });
  }

  // Nom du fichier
  const dateStr = new Date(session.created_at).toISOString().slice(0, 10);
  const typeName = (session.type_nom || 'checklist').replace(/\s+/g, '_');
  const fileName = `LogiTrack_${typeName}_S${session.id}_${dateStr}.pdf`;

  doc.save(fileName);
}
