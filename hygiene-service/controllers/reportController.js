const Report = require('../models/report');
const Inspection = require('../models/inspection');
const Zone = require('../models/zone');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

/**
 * Contrôleur pour la gestion des rapports du service d'hygiène
 */

/**
 * Créer un nouveau rapport
 * @route POST /reports
 * @access Privé
 */
exports.createReport = async (req, res, next) => {
  try {
    const { title, type, period, relatedInspections, relatedZones, content } = req.body;
    
    // Vérifier que le contenu est fourni
    if (!content || !content.summary) {
      return res.status(400).json({ error: 'Le résumé du rapport est requis' });
    }
    
    // Créer le rapport
    const report = new Report({
      title,
      type: type || 'summary',
      generatedBy: req.user.id,
      period,
      relatedInspections,
      relatedZones,
      content,
      status: 'draft'
    });
    
    await report.save();
    
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer tous les rapports avec filtrage et pagination
 * @route GET /reports
 * @access Privé
 */
exports.getReports = async (req, res, next) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;
    
    // Construire le filtre
    const filter = {};
    
    if (type) {
      filter.type = type;
    }
    
    if (status) {
      filter.status = status;
    }
    
    // Calculer le nombre total de rapports correspondant au filtre
    const total = await Report.countDocuments(filter);
    
    // Récupérer les rapports avec pagination
    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      count: reports.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit)
      },
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Récupérer les détails d'un rapport
 * @route GET /reports/:reportId
 * @access Privé
 */
exports.getReportDetails = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mettre à jour un rapport
 * @route PUT /reports/:reportId
 * @access Privé
 */
exports.updateReport = async (req, res, next) => {
  try {
    const { title, type, period, relatedInspections, relatedZones, content } = req.body;
    
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Vérifier si le rapport peut être mis à jour
    if (report.status === 'published' || report.status === 'archived') {
      return res.status(400).json({ error: `Le rapport ne peut pas être modifié car il est ${report.status}` });
    }
    
    // Mettre à jour le rapport
    if (title) report.title = title;
    if (type) report.type = type;
    if (period) report.period = period;
    if (relatedInspections) report.relatedInspections = relatedInspections;
    if (relatedZones) report.relatedZones = relatedZones;
    if (content) report.content = content;
    
    await report.save();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publier un rapport
 * @route POST /reports/:reportId/publish
 * @access Privé (Superviseur)
 */
exports.publishReport = async (req, res, next) => {
  try {
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Vérifier si le rapport peut être publié
    if (report.status === 'published' || report.status === 'archived') {
      return res.status(400).json({ error: `Le rapport est déjà ${report.status}` });
    }
    
    // Vérifier si le rapport est publiable
    if (!report.isPublishable()) {
      return res.status(400).json({ error: 'Le rapport n\'est pas publiable. Assurez-vous qu\'il contient un résumé.' });
    }
    
    // Publier le rapport
    report.status = 'published';
    report.publishedAt = new Date();
    
    await report.save();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archiver un rapport
 * @route POST /reports/:reportId/archive
 * @access Privé (Superviseur)
 */
exports.archiveReport = async (req, res, next) => {
  try {
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Vérifier si le rapport peut être archivé
    if (report.status === 'archived') {
      return res.status(400).json({ error: 'Le rapport est déjà archivé' });
    }
    
    // Archiver le rapport
    report.status = 'archived';
    
    await report.save();
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ajouter des pièces jointes à un rapport
 * @route POST /reports/:reportId/attachments
 * @access Privé
 */
exports.addAttachments = async (req, res, next) => {
  try {
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Vérifier si le rapport peut être modifié
    if (report.status === 'published' || report.status === 'archived') {
      return res.status(400).json({ error: `Le rapport ne peut pas être modifié car il est ${report.status}` });
    }
    
    // Vérifier si des fichiers ont été uploadés
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucune pièce jointe n\'a été fournie' });
    }
    
    // Ajouter les pièces jointes au rapport
    const attachments = req.files.map(file => ({
      name: file.originalname,
      url: `/uploads/reports/${file.filename}`,
      type: file.mimetype,
      size: file.size
    }));
    
    report.attachments = [...(report.attachments || []), ...attachments];
    
    await report.save();
    
    res.json({
      success: true,
      data: {
        attachments: report.attachments
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Générer un rapport PDF
 * @route GET /reports/:reportId/pdf
 * @access Privé
 */
exports.generatePdf = async (req, res, next) => {
  try {
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Créer le répertoire de sortie s'il n'existe pas
    const outputDir = path.join(__dirname, '../uploads/exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Nom du fichier PDF
    const fileName = `rapport_${report._id}_${Date.now()}.pdf`;
    const filePath = path.join(outputDir, fileName);
    
    // Créer le document PDF
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    
    doc.pipe(stream);
    
    // Ajouter le contenu au PDF
    doc.fontSize(20).text(report.title, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Type: ${report.type}`, { align: 'left' });
    doc.fontSize(12).text(`Date de création: ${new Date(report.createdAt).toLocaleDateString()}`, { align: 'left' });
    if (report.publishedAt) {
      doc.fontSize(12).text(`Date de publication: ${new Date(report.publishedAt).toLocaleDateString()}`, { align: 'left' });
    }
    doc.moveDown();
    
    // Ajouter le résumé
    doc.fontSize(16).text('Résumé', { underline: true });
    doc.fontSize(12).text(report.content.summary);
    doc.moveDown();
    
    // Ajouter les constats si disponibles
    if (report.content.findings) {
      doc.fontSize(16).text('Constats', { underline: true });
      doc.fontSize(12).text(report.content.findings);
      doc.moveDown();
    }
    
    // Ajouter les recommandations si disponibles
    if (report.content.recommendations) {
      doc.fontSize(16).text('Recommandations', { underline: true });
      doc.fontSize(12).text(report.content.recommendations);
      doc.moveDown();
    }
    
    // Finaliser le document
    doc.end();
    
    // Attendre que le fichier soit écrit
    stream.on('finish', () => {
      // Envoyer le fichier
      res.download(filePath, fileName, (err) => {
        if (err) {
          logger.error(`Erreur lors de l'envoi du fichier PDF: ${err.message}`);
          return res.status(500).json({ error: 'Erreur lors de la génération du PDF' });
        }
        
        // Supprimer le fichier après l'envoi
        fs.unlinkSync(filePath);
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Générer un rapport Excel
 * @route GET /reports/:reportId/excel
 * @access Privé
 */
exports.generateExcel = async (req, res, next) => {
  try {
    // Vérifier si le rapport existe
    const report = await Report.findById(req.params.reportId);
    
    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }
    
    // Créer le répertoire de sortie s'il n'existe pas
    const outputDir = path.join(__dirname, '../uploads/exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Nom du fichier Excel
    const fileName = `rapport_${report._id}_${Date.now()}.xlsx`;
    const filePath = path.join(outputDir, fileName);
    
    // Créer le document Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rapport');
    
    // Ajouter les en-têtes
    worksheet.addRow(['Rapport d\'hygiène']);
    worksheet.addRow(['']);
    worksheet.addRow(['Titre', report.title]);
    worksheet.addRow(['Type', report.type]);
    worksheet.addRow(['Date de création', new Date(report.createdAt).toLocaleDateString()]);
    if (report.publishedAt) {
      worksheet.addRow(['Date de publication', new Date(report.publishedAt).toLocaleDateString()]);
    }
    worksheet.addRow(['Statut', report.status]);
    worksheet.addRow(['']);
    
    // Ajouter le résumé
    worksheet.addRow(['Résumé']);
    worksheet.addRow([report.content.summary]);
    worksheet.addRow(['']);
    
    // Ajouter les constats si disponibles
    if (report.content.findings) {
      worksheet.addRow(['Constats']);
      worksheet.addRow([report.content.findings]);
      worksheet.addRow(['']);
    }
    
    // Ajouter les recommandations si disponibles
    if (report.content.recommendations) {
      worksheet.addRow(['Recommandations']);
      worksheet.addRow([report.content.recommendations]);
      worksheet.addRow(['']);
    }
    
    // Si le rapport contient des statistiques, les ajouter
    if (report.content.statistics) {
      worksheet.addRow(['Statistiques']);
      
      // Ajouter chaque statistique
      for (const [key, value] of Object.entries(report.content.statistics)) {
        worksheet.addRow([key, typeof value === 'object' ? JSON.stringify(value) : value]);
      }
    }
    
    // Enregistrer le fichier
    await workbook.xlsx.writeFile(filePath);
    
    // Envoyer le fichier
    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error(`Erreur lors de l'envoi du fichier Excel: ${err.message}`);
        return res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel' });
      }
      
      // Supprimer le fichier après l'envoi
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Télécharger un rapport
 * @route GET /reports/download/:reportId
 * @access Privé
 */
exports.downloadReport = async (req, res, next) => {
  try {
    // Rediriger vers la génération de PDF par défaut
    exports.generatePdf(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Générer un rapport périodique
 * @route POST /reports/generate/periodic
 * @access Privé (Superviseur)
 */
exports.generatePeriodicReport = async (req, res, next) => {
  try {
    const { period, title, type = 'periodic' } = req.body;
    
    if (!period || !period.startDate || !period.endDate) {
      return res.status(400).json({ error: 'La période est requise (startDate et endDate)' });
    }
    
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);
    
    // Vérifier que la période est valide
    if (startDate >= endDate) {
      return res.status(400).json({ error: 'La date de début doit être antérieure à la date de fin' });
    }
    
    // Récupérer les inspections pour la période
    const inspections = await Inspection.find({
      scheduledDate: { $gte: startDate, $lte: endDate }
    });
    
    // Calculer les statistiques
    const totalInspections = inspections.length;
    const completedInspections = inspections.filter(i => i.status === 'completed').length;
    const cancelledInspections = inspections.filter(i => i.status === 'cancelled').length;
    
    // Calculer la répartition par niveau de violation
    const violationLevels = ['none', 'minor', 'moderate', 'severe', 'critical'];
    const violationStats = {};
    
    violationLevels.forEach(level => {
      violationStats[level] = inspections.filter(i => i.violationLevel === level).length;
    });
    
    // Créer le contenu du rapport
    const reportTitle = title || `Rapport périodique (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
    const summary = `Ce rapport couvre la période du ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}. ` +
      `Durant cette période, ${totalInspections} inspections ont été planifiées, dont ${completedInspections} ont été complétées ` +
      `et ${cancelledInspections} ont été annulées.`;
    
    // Créer le rapport
    const report = new Report({
      title: reportTitle,
      type,
      generatedBy: req.user.id,
      period: {
        startDate,
        endDate
      },
      relatedInspections: inspections.map(i => i._id),
      content: {
        summary,
        statistics: {
          totalInspections,
          completedInspections,
          cancelledInspections,
          completionRate: totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0,
          violationStats
        }
      },
      status: 'draft'
    });
    
    await report.save();
    
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Générer un rapport de zone
 * @route POST /reports/generate/zone/:zoneId
 * @access Privé (Superviseur)
 */
exports.generateZoneReport = async (req, res, next) => {
  try {
    const { zoneId } = req.params;
    const { period, title } = req.body;
    
    // Vérifier si la zone existe
    const zone = await Zone.findById(zoneId);
    
    if (!zone) {
      return res.status(404).json({ error: 'Zone non trouvée' });
    }
    
    // Définir la période
    let startDate, endDate;
    
    if (period && period.startDate && period.endDate) {
      startDate = new Date(period.startDate);
      endDate = new Date(period.endDate);
    } else {
      // Par défaut, utiliser les 30 derniers jours
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }
    
    // Récupérer les inspections dans la zone pour la période
    const inspections = await Inspection.find({
      'location.type': 'Point',
      'location.coordinates': {
        $geoWithin: {
          $geometry: zone.boundary
        }
      },
      scheduledDate: { $gte: startDate, $lte: endDate }
    });
    
    // Calculer les statistiques
    const totalInspections = inspections.length;
    const completedInspections = inspections.filter(i => i.status === 'completed').length;
    
    // Créer le contenu du rapport
    const reportTitle = title || `Rapport de la zone ${zone.name}`;
    const summary = `Ce rapport concerne la zone "${zone.name}" (niveau de risque: ${zone.riskLevel}) ` +
      `pour la période du ${startDate.toLocaleDateString()} au ${endDate.toLocaleDateString()}. ` +
      `Durant cette période, ${totalInspections} inspections ont été réalisées dans cette zone, ` +
      `dont ${completedInspections} ont été complétées.`;
    
    // Créer le rapport
    const report = new Report({
      title: reportTitle,
      type: 'zone',
      generatedBy: req.user.id,
      period: {
        startDate,
        endDate
      },
      relatedInspections: inspections.map(i => i._id),
      relatedZones: [zoneId],
      content: {
        summary,
        statistics: {
          zoneName: zone.name,
          zoneRiskLevel: zone.riskLevel,
          zoneAlertCount: zone.alertCount,
          totalInspections,
          completedInspections,
          completionRate: totalInspections > 0 ? (completedInspections / totalInspections) * 100 : 0
        }
      },
      status: 'draft'
    });
    
    await report.save();
    
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
};
