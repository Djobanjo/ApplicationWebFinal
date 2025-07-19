require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { execSync } = require('child_process');
const tmp = require('tmp');
const cors = require('cors');
const fetch = require('node-fetch');

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

const app = express();
const PORT = 5000;

app.use(cors()); // Requête cross-origin

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // Limite 3 Mo
});

function getFormattedTimestamp() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

function getFormattedFileName(baseName, ext) {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  return `${baseName}_${day}_${month}_${year}-${hour}_${minute}_${second}${ext}`;
}

const validateAndProcessImage = async (buffer, field) => {
  let image = sharp(buffer);
  const metadata = await image.metadata();
  let { width, height, format } = metadata;

  if (field === 'photo' || field === 'signature') {
    if (format !== 'jpeg') {
      buffer = await image.jpeg({ quality: 90 }).toBuffer();
      image = sharp(buffer);
    }
  }

  if (field === 'photo') {
    if (width < 200 || height < 200) {
      throw new Error('Photo: dimensions trop petites (<200px)');
    }
    if (width > 1500 || height > 1500 || buffer.length > 500 * 1024) {
      buffer = await image
        .resize({
          width: Math.min(width, 1500),
          height: Math.min(height, 1500),
          fit: 'inside'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
  }

  if (field === 'signature') {
    if (width < 200 || height < 67) {
      throw new Error('Signature: dimensions trop petites (<200x67)');
    }

    const ratio = width / height;
    const minRatio = 2.8;
    const maxRatio = 3.2;

    if (ratio < minRatio || ratio > maxRatio) {
      const targetHeight = Math.max(67, Math.min(height, 400));
      const targetWidth = Math.min(3500, targetHeight * 3);

      buffer = await image
        .resize({
          width: Math.round(targetWidth),
          height: Math.round(targetHeight),
          fit: 'fill'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const resizedMeta = await sharp(buffer).metadata();
      width = resizedMeta.width;
      height = resizedMeta.height;
    }

    if (width > 3500 || height > 2500 || buffer.length > 1024 * 1024) {
      buffer = await sharp(buffer)
        .resize({
          width: Math.min(width, 3500),
          height: Math.min(height, 2500),
          fit: 'inside'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
  }

  return buffer;
};

const validatePasseport = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    throw new Error('Le passeport doit être un fichier PDF.');
  }

  if (file.size <= 1 * 1024 * 1024) {
    // ≤ 1 Mo : pas de compression
    return file.buffer;
  }

  // Compression pour > 1 Mo
  const inputPath = tmp.tmpNameSync({ postfix: '.pdf' });
  const outputPath = tmp.tmpNameSync({ postfix: '.pdf' });
  require('fs').writeFileSync(inputPath, file.buffer);

  try {
    execSync(`gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/screen -dDownsampleColorImages=true -dColorImageResolution=100 -dDownsampleGrayImages=true -dGrayImageResolution=100 -dDownsampleMonoImages=true -dMonoImageResolution=100 -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`);

    const compressedBuffer = require('fs').readFileSync(outputPath);
    require('fs').unlinkSync(inputPath);
    require('fs').unlinkSync(outputPath);

    return compressedBuffer;
  } catch (error) {
    console.error('Erreur Ghostscript:', error);
    throw new Error("Erreur lors de la compression du passeport (Ghostscript)");
  }
};

async function sendToGoogleAppsScript(clientName, photoBuffer, signatureBuffer, passeportBuffer) {
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  const photoDataUrl = bufferToDataUrl(photoBuffer, 'image/jpeg');
  const signatureDataUrl = bufferToDataUrl(signatureBuffer, 'image/jpeg');
  const passeportDataUrl = bufferToDataUrl(passeportBuffer, 'application/pdf');

  const photoBase64 = photoDataUrl.split(',')[1];
  const signatureBase64 = signatureDataUrl.split(',')[1];
  const passeportBase64 = passeportDataUrl.split(',')[1];

  const photoFileName = getFormattedFileName('photo', '.jpg');
  const signatureFileName = getFormattedFileName('signature', '.jpg');
  const passeportFileName = getFormattedFileName('passeport', '.pdf');

  const payload = {
    folders: [
      {
        name: clientName,
        files: [
          { name: photoFileName, content: photoBase64, type: 'image/jpeg' },
          { name: signatureFileName, content: signatureBase64, type: 'image/jpeg' },
          { name: passeportFileName, content: passeportBase64, type: 'application/pdf' }
        ]
      }
    ]
  };

  const response = await fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur Apps Script: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

app.post('/upload', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'passeport', maxCount: 1 }
]), async (req, res) => {
  try {
    const files = req.files;
    const clientName = (req.body.nom || '').trim();

    if (!files.photo || !files.signature || !files.passeport || !clientName) {
      return res.status(400).send('Tous les champs sont obligatoires.');
    }

    const photoBuffer = await validateAndProcessImage(files.photo[0].buffer, 'photo');
    const signatureBuffer = await validateAndProcessImage(files.signature[0].buffer, 'signature');
    const passeportBuffer = await validatePasseport(files.passeport[0]);

    await sendToGoogleAppsScript(clientName, photoBuffer, signatureBuffer, passeportBuffer);

    return res.send('Fichiers envoyés avec succès, sans stockage local.');
  } catch (err) {
    return res.status(400).send(`Erreur : ${err.message}`);
  }
});

app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur sur http://localhost:${PORT}`);
});
