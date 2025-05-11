import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheetId = process.env.GOOGLE_SHEET_ID;
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// 修正私鑰中的換行符號
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// ✅ 記錄或更新假期
export async function updateVacation(groupId, month, displayName, userId, vacationText) {
  const range = '工作表1!A2:E';
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values || [];
  const lowerMonth = month.trim();
  const matchedIndex = rows.findIndex(row => row[0] === groupId && row[1] === lowerMonth && row[3] === userId);

  if (matchedIndex !== -1) {
    const current = rows[matchedIndex][4] || '';
    if (current === vacationText) return 'same';

    const updateRange = `工作表1!E${matchedIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: { values: [[vacationText]] }
    });
    return 'updated';
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: '工作表1!A:E',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[groupId, lowerMonth, displayName, userId, vacationText]]
    }
  });

  return 'new';
}

// ✅ 查詢指定群組與月份的所有假期紀錄
export async function getVacationByMonth(groupId, month) {
  const range = '工作表1!A2:E';
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values || [];
  const lowerMonth = month.trim();
  return rows.filter(row => row[0] === groupId && row[1] === lowerMonth && row[4]);
}

// ✅ 清除使用者該月假期（清空 E 欄）
export async function clearVacation(groupId, month, userId) {
  const range = '工作表1!A2:E';
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values || [];
  const lowerMonth = month.trim();
  const matchedIndex = rows.findIndex(row => row[0] === groupId && row[1] === lowerMonth && row[3] === userId);

  if (matchedIndex === -1) return false;

  const clearRange = `工作表1!E${matchedIndex + 2}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: clearRange,
    valueInputOption: 'RAW',
    requestBody: { values: [['']] }
  });

  return true;
}
