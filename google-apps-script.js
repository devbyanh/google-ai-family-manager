// ============================================================
// GOOGLE APPS SCRIPT - Paste code này vào Apps Script Editor
// ============================================================
// Hướng dẫn:
// 1. Mở Google Sheet → Tiện ích mở rộng → Apps Script
// 2. Xoá code mặc định, paste toàn bộ code này vào
// 3. Nhấn Lưu (Ctrl+S)
// 4. Triển khai → Triển khai mới → chọn "Ứng dụng web"
//    - Thực thi với tư cách: "Tôi" (Me)
//    - Quyền truy cập: "Bất kỳ ai" (Anyone)
// 5. Copy URL Web App → dán vào phần Cài đặt trong ứng dụng
//
// Google Sheet cần có 4 sheet tabs:
//   - "Đơn hàng"  (Orders)
//   - "Acc mẹ"    (Accounts)
//   - "Nền tảng"  (Platforms)
//   - "Sản phẩm"  (Products)
// ============================================================

// --- Sheet column headers ---
const HEADERS = {
  'Đơn hàng': ['_id', 'madon', 'email', 'product', 'status', 'orderDate', 'price', 'platform', 'accId', 'accNumber', 'note', 'createdAt'],
  'Acc mẹ': ['_id', 'accNumber', 'email', 'plan', 'note', 'createdAt'],
  'Nền tảng': ['name'],
  'Sản phẩm': ['id', 'name', 'price', 'color', 'duration'],
  'Cài đặt': ['key', 'value'],
};

// ========== GET HANDLER ==========
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getData';

    if (action === 'getData') {
      return jsonResponse(getAllData());
    }

    if (action === 'getSheet') {
      const sheetName = e.parameter.sheet;
      return jsonResponse({ data: getSheetData(sheetName) });
    }

    return jsonResponse({ error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ========== POST HANDLER ==========
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'syncAll':
        return jsonResponse(syncAllData(body.data));

      case 'addRow':
        return jsonResponse(addRow(body.sheet, body.row));

      case 'updateRow':
        return jsonResponse(updateRow(body.sheet, body.id, body.row));

      case 'deleteRow':
        return jsonResponse(deleteRow(body.sheet, body.id));

      case 'sendEmails':
        return jsonResponse(sendEmails(body.emails));

      case 'syncSheet':
        return jsonResponse(syncSheet(body.sheet, body.data));

      default:
        return jsonResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ========== CORE FUNCTIONS ==========

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  for (const sheetName in HEADERS) {
    result[sheetName] = getSheetData(sheetName);
  }

  return { success: true, data: result };
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Auto-create sheet with headers
    sheet = ss.insertSheet(sheetName);
    const headers = HEADERS[sheetName] || [];
    if (headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    }
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only headers or empty

  const headers = data[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      // Handle Date objects from Sheets
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy');
      }
      obj[h] = val !== undefined && val !== null ? String(val) : '';
    });
    rows.push(obj);
  }

  return rows;
}

function syncAllData(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Map from frontend keys to sheet names
  const keyMap = {
    orders: 'Đơn hàng',
    accounts: 'Acc mẹ',
    platforms: 'Nền tảng',
    products: 'Sản phẩm',
    settings: 'Cài đặt',
  };

  for (const key in keyMap) {
    const sheetName = keyMap[key];
    let items = data[key];
    if (!items) continue;

    // For platforms, convert array of strings to array of objects
    if (key === 'platforms' && items.length > 0 && typeof items[0] === 'string') {
      items = items.map(name => ({ name: name }));
    }

    syncSheet(sheetName, items);
  }

  return { success: true, message: 'Đã đồng bộ tất cả dữ liệu' };
}

function syncSheet(sheetName, dataArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName];

  if (!headers) return { error: 'Unknown sheet: ' + sheetName };

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Clear existing data
  sheet.clear();

  // Write headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  if (!dataArray || dataArray.length === 0) {
    return { success: true, count: 0 };
  }

  // Write data rows
  const rows = dataArray.map(obj => {
    return headers.map(h => {
      const val = obj[h];
      return val !== undefined && val !== null ? val : '';
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return { success: true, count: rows.length };
}

function addRow(sheetName, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const headers = HEADERS[sheetName];

  if (!headers) return { error: 'Unknown sheet: ' + sheetName };

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  const row = headers.map(h => {
    const val = rowData[h];
    return val !== undefined && val !== null ? val : '';
  });

  sheet.appendRow(row);
  return { success: true };
}

function updateRow(sheetName, id, rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = HEADERS[sheetName];
  const idCol = headers.indexOf('_id') + 1; // 1-indexed
  if (idCol === 0) return { error: 'No _id column in ' + sheetName };

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol - 1]) === String(id)) {
      const row = headers.map(h => {
        const val = rowData[h];
        return val !== undefined && val !== null ? val : '';
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return { success: true };
    }
  }

  return { error: 'Row not found with _id: ' + id };
}

function deleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = HEADERS[sheetName];
  const idCol = headers.indexOf('_id') + 1;
  if (idCol === 0) return { error: 'No _id column in ' + sheetName };

  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol - 1]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { error: 'Row not found with _id: ' + id };
}

// ========== UTILITY ==========

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== EMAIL SERVICE ==========
function sendEmails(emails) {
  if (!emails || !Array.isArray(emails)) {
    return { error: 'Invalid emails array' };
  }

  let successCount = 0;
  let errors = [];

  for (let i = 0; i < emails.length; i++) {
    try {
      const mail = emails[i];
      if (mail.to && mail.subject && mail.body) {
        GmailApp.sendEmail(mail.to, mail.subject, mail.body, {
          htmlBody: mail.htmlBody || mail.body
        });
        successCount++;
      }
    } catch (e) {
      errors.push(`Error sending to ${emails[i]?.to}: ${e.message}`);
    }
  }

  return { success: true, count: successCount, errors: errors };
}

// ========== SETUP (Run once) ==========
// Run this function manually to create all sheets with headers
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const sheetName in HEADERS) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = HEADERS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

    // Auto-resize columns
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }

  SpreadsheetApp.getUi().alert('Đã tạo xong các sheet: ' + Object.keys(HEADERS).join(', '));
}
