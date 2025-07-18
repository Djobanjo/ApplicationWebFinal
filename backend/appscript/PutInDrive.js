function doPost(e) {
  try {
    Logger.log("Début doPost");

    const data = JSON.parse(e.postData.contents);

    const rootFolderId = "14vJanwJ1yXBPSACWu_9C-r7Mz1-Uutk7";
    const rootFolder = DriveApp.getFolderById(rootFolderId);

    const sheetId = "1pSPpUUP-3Ok_8cl5KFWRcvcEGYEAoj1xxbPtmfv7cbQ";
    const sheet = SpreadsheetApp.openById(sheetId).getSheetByName("EnvoieDossierDrive");

    // Ajoute l'en-tête si vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Nom du dossier", "Date de création", "Lien"]);
    }

    data.folders.forEach(folder => {
      const subFolder = rootFolder.createFolder(folder.name);

      folder.files.forEach(file => {
        const blob = Utilities.newBlob(
          Utilities.base64Decode(file.content),
          file.type,
          file.name
        );
        subFolder.createFile(blob);
      });
      function testVoirSousDossiers() {
  const rootFolderId = "14vJanwJ1yXBPSACWu_9C-r7Mz1-Uutk7"; // Ton dossier Drive
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const folders = rootFolder.getFolders();

  Logger.log("Sous-dossiers dans le dossier : " + rootFolder.getName());

  while (folders.hasNext()) {
    const folder = folders.next();
    Logger.log("Nom : " + folder.getName() + " | Date de création : " + folder.getDateCreated());
  }
}

      const folderName = subFolder.getName();
      const creationDate = Utilities.formatDate(subFolder.getDateCreated(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
      const folderUrl = subFolder.getUrl();

      sheet.appendRow([
        folderName,
        creationDate,
        `=HYPERLINK("${folderUrl}"; "Lien")`
      ]);
    });

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
