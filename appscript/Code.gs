const SHEETS = [
  "sales",
  "products",
  "customers",
  "purchases",
  "expenses",
  "credits",
  "cash_movements",
  "inventory_movements",
  "sync_log",
];

function doGet() {
  return jsonOutput({ ok: true, service: "pollo-pos-appscript", timestamp: new Date().toISOString() });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const action = payload.action;

    if (action === "sync") {
      return jsonOutput(syncItems_(payload.items || []));
    }

    if (action === "backup") {
      return jsonOutput(fullBackup_(payload.data || {}));
    }

    return jsonOutput({ ok: false, error: "Acción no soportada" });
  } catch (error) {
    return jsonOutput({ ok: false, error: error.message, stack: error.stack });
  }
}

function syncItems_(items) {
  const spreadsheet = getSpreadsheet_();
  ensureSheets_(spreadsheet);

  items.forEach(function(item) {
    const sheetName = routeSheet_(item.type);
    const sheet = spreadsheet.getSheetByName(sheetName);
    sheet.appendRow([
      item.id || Utilities.getUuid(),
      item.type,
      item.createdAt || new Date().toISOString(),
      JSON.stringify(item.payload || {}),
    ]);
  });

  spreadsheet.getSheetByName("sync_log").appendRow([
    new Date().toISOString(),
    items.length,
    Session.getActiveUser().getEmail() || "anonymous",
  ]);

  return { ok: true, synced: items.length };
}

function fullBackup_(data) {
  const spreadsheet = getSpreadsheet_();
  ensureSheets_(spreadsheet);

  Object.keys(data).forEach(function(key) {
    const value = data[key];
    const sheet = spreadsheet.getSheetByName(routeBackupSheet_(key));
    sheet.clearContents();
    sheet.appendRow(["backup_at", "payload"]);
    sheet.appendRow([new Date().toISOString(), JSON.stringify(value)]);
  });

  return { ok: true, backedUp: Object.keys(data).length };
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheets_(spreadsheet) {
  SHEETS.forEach(function(name) {
    if (!spreadsheet.getSheetByName(name)) {
      spreadsheet.insertSheet(name);
    }
  });
}

function routeSheet_(type) {
  if (type.indexOf("sale") === 0) return "sales";
  if (type.indexOf("product") === 0) return "products";
  if (type.indexOf("customer") === 0) return "customers";
  if (type.indexOf("purchase") === 0) return "purchases";
  if (type.indexOf("expense") === 0) return "expenses";
  if (type.indexOf("credit") === 0) return "credits";
  if (type.indexOf("cash") === 0) return "cash_movements";
  return "inventory_movements";
}

function routeBackupSheet_(key) {
  return SHEETS.indexOf(key) > -1 ? key : "sync_log";
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
