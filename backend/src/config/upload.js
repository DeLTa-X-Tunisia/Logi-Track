/**
 * Configuration Multer pour l'upload de fichiers
 * LogiTrack - Gestion des uploads de photos
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, '../../uploads');
const bobinesUploadsDir = path.join(uploadsDir, 'bobines');
const projetUploadsDir = path.join(uploadsDir, 'projet');
const tubesUploadsDir = path.join(uploadsDir, 'tubes');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(bobinesUploadsDir)) {
  fs.mkdirSync(bobinesUploadsDir, { recursive: true });
}
if (!fs.existsSync(projetUploadsDir)) {
  fs.mkdirSync(projetUploadsDir, { recursive: true });
}
if (!fs.existsSync(tubesUploadsDir)) {
  fs.mkdirSync(tubesUploadsDir, { recursive: true });
}

// Configuration du stockage pour les photos de bobines
const bobineStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bobinesUploadsDir);
  },
  filename: (req, file, cb) => {
    // Format: bobine_{bobineId}_{timestamp}_{random}.{ext}
    const bobineId = req.params.id || 'temp';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bobine_${bobineId}_${uniqueSuffix}${ext}`);
  }
});

// Filtre pour n'accepter que les images
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seules les images (JPEG, PNG, GIF, WEBP) sont acceptées.'), false);
  }
};

// Upload pour les photos de bobines (max 5 photos, max 5MB chacune)
const uploadBobinePhotos = multer({
  storage: bobineStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max par fichier
    files: 5 // Max 5 fichiers
  }
});

// Configuration du stockage pour les photos d'étapes de tubes
const tubeEtapeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tubesUploadsDir);
  },
  filename: (req, file, cb) => {
    const tubeId = req.params.id || 'temp';
    const etapeNumero = req.params.etape || '0';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `tube_${tubeId}_etape_${etapeNumero}_${uniqueSuffix}${ext}`);
  }
});

// Upload pour les photos d'étapes de tubes (max 5 photos, max 5MB chacune)
const uploadTubeEtapePhotos = multer({
  storage: tubeEtapeStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  }
});

module.exports = {
  uploadBobinePhotos,
  uploadTubeEtapePhotos,
  bobinesUploadsDir,
  projetUploadsDir,
  tubesUploadsDir,
  uploadsDir
};
