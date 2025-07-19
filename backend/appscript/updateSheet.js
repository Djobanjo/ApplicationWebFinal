//Mets a jour la feuille avec les nouveaux dossiers (Toutes les minutes) 

function updateSheet() {
  const sheetId = "1pSPpUUP-3Ok_8cl5KFWRcvcEGYEAoj1xxbPtmfv7cbQ";
  const sheetName = "EnvoieDossierDrive";
  const folderId = "14vJanwJ1yXBPSACWu_9C-r7Mz1-Uutk7";

  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  const rootFolder = DriveApp.getFolderById(folderId);

  if (sheet.getLastColumn() === 0) {
    // Feuille vide → ajout des en-têtes
    sheet.appendRow(["Nom du dossier", "Date de création", "Lien"]);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nameCol = headers.indexOf("Nom du dossier") + 1;
  const dateCol = headers.indexOf("Date de création") + 1;
  const linkCol = headers.indexOf("Lien") + 1;

  if (nameCol === 0 || dateCol === 0 || linkCol === 0) {
    throw new Error("Les colonnes 'Nom du dossier', 'Date de création' ou 'Lien' sont manquantes.");
  }

  const lastRow = sheet.getLastRow();
  const existingNames = lastRow > 1
    ? sheet.getRange(2, nameCol, lastRow - 1, 1).getValues().flat().filter(n => n)
    : [];

  const folders = rootFolder.getFolders();
  const newRows = [];

  while (folders.hasNext()) {
    const folder = folders.next();
    const fullName = folder.getName();
    const name = fullName.replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/, "");

    if (existingNames.includes(name)) continue;

    const created = Utilities.formatDate(folder.getDateCreated(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    const url = folder.getUrl();

    const row = new Array(headers.length).fill('');
    row[nameCol - 1] = name;
    row[dateCol - 1] = created;
    row[linkCol - 1] = `=HYPERLINK("${url}"; "Lien")`;

    newRows.push(row);
  }

  if (newRows.length > 0) {
    if (lastRow > 1) {
      sheet.insertRowsAfter(1, newRows.length);
    }
    sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
  }
}

