// Clinic Revenue OS — Google Apps Script: מקבל ליד מ-Meta ומוסיף שורה ל-Google Sheet.
// הוראות: README בתיקיית CRM/supabase (שלב 7). פורסים כ-Web app (Execute as: Me, Access: Anyone).
// הסוד (SHARED_SECRET) חייב להיות זהה ל-GOOGLE_SHEET_SECRET ב-Supabase secrets.

const SHARED_SECRET = 'CHANGE_ME';
const SHEET_NAME = 'Meta Leads';
const HEADERS = ['תאריך', 'שם', 'טלפון', 'אימייל', 'קמפיין', 'מודעה', 'טופס', 'Lead ID', 'שדות נוספים'];

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.secret !== SHARED_SECRET) return out({ ok: false, error: 'unauthorized' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  // מניעת כפילויות לפי Lead ID (Meta עשויה לשלוח את אותו webhook כמה פעמים)
  const ids = sheet.getLastRow() > 1 ? sheet.getRange(2, 8, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  if (ids.indexOf(body.lead_id) !== -1) return out({ ok: true, duplicate: true });
  sheet.appendRow([body.created_time, body.name, "'" + body.phone, body.email, body.campaign, body.ad, body.form, body.lead_id, body.extra]);
  return out({ ok: true });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
