const fs = require('fs');
const sharp = require('sharp');

const INPUT_PATH = './signHaut.png';
const OUTPUT_PATH = './signature_cropped_box.jpg';

async function detectAndCropSignatureBox() {
  const image = sharp(INPUT_PATH);
  const { data, info } = await image
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 180; // seuil pour considérer un pixel comme "sombre"
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

  // Si rien de sombre détecté
  if (minX > maxX || minY > maxY) {
    console.error("❌ Aucune signature détectée.");
    return;
  }

  // Ajouter une marge autour
  const padding = 130;
  minX = Math.max(minX - padding, 0);
  minY = Math.max(minY - padding, 0);
  maxX = Math.min(maxX + padding, info.width - 1);
  maxY = Math.min(maxY + padding, info.height - 1);

  const width = maxX - minX;
  const height = maxY - minY;

  console.log(`📍 Cadre signature : x=${minX}, y=${minY}, width=${width}, height=${height}`);

  // Crop la zone détectée autour de la signature
  await sharp(INPUT_PATH)
    .extract({ left: minX, top: minY, width, height })
    .toFile(OUTPUT_PATH);

  console.log(`✅ Image recadrée enregistrée dans : ${OUTPUT_PATH}`);
}

detectAndCropSignatureBox().catch(console.error);
