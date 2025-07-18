function testScanDossiersEtEcriture() {
  const rootFolderId = "14vJanwJ1yXBPSACWu_9C-r7Mz1-Uutk7"; // ID du dossier Drive
  const sheetId = "1pSPpUUP-3Ok_8cl5KFWRcvcEGYEAoj1xxbPtmfv7cbQ"; // ID de ta Google Sheet
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName("EnvoieDossierDrive");

  if (!sheet) {
    Logger.log("❌ Feuille 'EnvoieDossierDrive' introuvable !");
    return;
  }

  // Vide le contenu et remet l'en-tête
  sheet.clearContents();
  sheet.appendRow(["Nom du dossier", "Date de création", "Lien"]);

  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const folders = rootFolder.getFolders();

  let rowIndex = 2;
  let count = 0;

  while (folders.hasNext()) {
    const subFolder = folders.next();
    const name = subFolder.getName();
    const created = Utilities.formatDate(subFolder.getDateCreated(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const url = subFolder.getUrl();

    // Colonne A et B : valeurs simples
    sheet.getRange(rowIndex, 1).setValue(name);
    sheet.getRange(rowIndex, 2).setValue(created);

    // Colonne C : formule HYPERLINK
    sheet.getRange(rowIndex, 3).setFormula(`=HYPERLINK("${url}"; "Lien")`);

    rowIndex++;
    count++;
  }

  Logger.log(`✅ ${count} sous-dossiers listés et écrits dans la feuille.`);
}
