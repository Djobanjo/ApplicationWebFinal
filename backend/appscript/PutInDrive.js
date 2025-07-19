//Ajoute dans le drive les fichiers envoyés

function doPost(e) {
  try {
    Logger.log("Début doPost");

    const data = JSON.parse(e.postData.contents);

    const rootFolderId = "14vJanwJ1yXBPSACWu_9C-r7Mz1-Uutk7"; //<== ID du dossier racine du drive
    const rootFolder = DriveApp.getFolderById(rootFolderId);

    if (data.folders && Array.isArray(data.folders)) {
      data.folders.forEach(folder => {
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
        const safeName = folder.name ? folder.name.toString().trim() : "Dossier_SansNom";
        const folderNameWithTimestamp = "`${timestamp}_${safeName}`";
        Logger.log("Création du dossier : " + folderNameWithTimestamp);

        const subFolder = rootFolder.createFolder(folderNameWithTimestamp);

        folder.files.forEach(file => {
          const dotIndex = file.name.lastIndexOf('.');
          let newFileName;
          if (dotIndex !== -1) {
            const namePart = file.name.substring(0, dotIndex);
            const extPart = file.name.substring(dotIndex);
            newFileName = `${namePart}_${timestamp}${extPart}`;
          } else {
            newFileName = `${file.name}_${timestamp}`;
          }

          const blob = Utilities.newBlob(
            Utilities.base64Decode(file.content),
            file.type,
            newFileName
          );
          subFolder.createFile(blob);
        });
      });
    } else {
      Logger.log("Aucun dossier à traiter.");
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Erreur : " + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


