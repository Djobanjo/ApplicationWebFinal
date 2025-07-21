require('dotenv').config();
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const { execSync } = require('child_process');
const tmp = require('tmp');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');

function bufferToDataUrl(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

const app = express();
const PORT = 5000;

app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 } // 3 Mo
});

function getFormattedFileName(baseName, ext) {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${baseName}_${pad(now.getDate())}_${pad(now.getMonth() + 1)}_${now.getFullYear()}-${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}${ext}`;
}

const validateAndProcessImage = async (buffer, field) => {
  let image = sharp(buffer);
  let metadata = await image.metadata();
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

    // Convert to greyscale raw pixels for signature detection
    const { data, info } = await sharp(buffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const threshold = 180; // seuil pour pixel "sombre"
    let minX = info.width, minY = info.height;
    let maxX = 0, maxY = 0;

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = y * info.width + x;
        const value = data[idx];
        if (value < threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (minX > maxX || minY > maxY) throw new Error("Signature introuvable dans l'image");

    const padding = 200;
    minX = Math.max(minX - padding, 0);
    minY = Math.max(minY - padding, 0);
    maxX = Math.min(maxX + padding, info.width - 1);
    maxY = Math.min(maxY + padding, info.height - 1);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    buffer = await sharp(buffer)
      .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
      .jpeg({ quality: 90 })
      .toBuffer();

    image = sharp(buffer);
    metadata = await image.metadata();
    width = metadata.width;
    height = metadata.height;

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
          fit: 'contain',
          background: { r: 255, g: 255, b: 255 }
        })
        .jpeg({ quality: 80 })
        .toBuffer();
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

const tryCompressPdf = (input, output, quality) => {
  try {
    const settings = {
      screen: '/screen',
      ebook: '/ebook',
      printer: '/printer'
    };

    const setting = settings[quality] || '/screen';
    console.log(`→ Compression PDF avec Ghostscript : ${setting}`);

    execSync(`gswin64c -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${setting} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${output}" "${input}"`);
    const resultBuffer = fs.readFileSync(output);
    console.log(`✓ Taille compressée (${quality}): ${(resultBuffer.length / 1024).toFixed(1)} Ko`);
    return resultBuffer;
  } catch (e) {
    console.error(`⚠️ Erreur compression Ghostscript (${quality})`, e);
    return null;
  }
};

const validatePasseport = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') throw new Error('Le passeport doit être un fichier PDF.');

  const MAX_SIZE = 1 * 1024 * 1024;
  if (file.size <= MAX_SIZE) {
    console.log("✓ PDF taille OK, pas de compression");
    return file.buffer;
  }

  const inputPath = tmp.tmpNameSync({ postfix: '.pdf' });
  const outputPath = tmp.tmpNameSync({ postfix: '.pdf' });
  fs.writeFileSync(inputPath, file.buffer);

  const qualities = ['screen', 'ebook', 'printer'];
  let bestBuffer = null;

  for (const quality of qualities) {
    const buffer = tryCompressPdf(inputPath, outputPath, quality);
    if (buffer && buffer.length <= MAX_SIZE) {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      return buffer;
    }
    if (!bestBuffer || (buffer && buffer.length < bestBuffer.length)) {
      bestBuffer = buffer;
    }
  }

  fs.unlinkSync(inputPath);
  fs.unlinkSync(outputPath);

  if (bestBuffer) {
    console.warn("⚠️ Aucun résultat <1Mo. Utilisation de la version la plus légère possible.");
    return bestBuffer;
  } else {
    throw new Error("Échec de la compression du PDF.");
  }
};

async function sendToGoogleAppsScript(clientName, photoBuffer, signatureBuffer, passeportBuffer) {
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;

  const payload = {
    folders: [
      {
        name: clientName,
        files: [
          { name: getFormattedFileName('photo', '.jpg'), content: bufferToDataUrl(photoBuffer, 'image/jpeg').split(',')[1], type: 'image/jpeg' },
          { name: getFormattedFileName('signature', '.jpg'), content: bufferToDataUrl(signatureBuffer, 'image/jpeg').split(',')[1], type: 'image/jpeg' },
          { name: getFormattedFileName('passeport', '.pdf'), content: bufferToDataUrl(passeportBuffer, 'application/pdf').split(',')[1], type: 'application/pdf' }
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

    console.log(`\n--- Upload de : ${clientName} ---`);
    const photoBuffer = await validateAndProcessImage(files.photo[0].buffer, 'photo');
    const signatureBuffer = await validateAndProcessImage(files.signature[0].buffer, 'signature');
    const passeportBuffer = await validatePasseport(files.passeport[0]);

    await sendToGoogleAppsScript(clientName, photoBuffer, signatureBuffer, passeportBuffer);

    return res.send('Fichiers envoyés avec succès, sans stockage local.');
  } catch (err) {
    console.error("❌ Erreur : ", err.message);
    return res.status(400).send(`Erreur : ${err.message}`);
  }
});

app.use(express.static(path.join(__dirname, '..', 'frontend', 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
