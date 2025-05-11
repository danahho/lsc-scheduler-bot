import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheetId = process.env.GOOGLE_SHEET_ID;
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// 修正 private_key 換行問題
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

// 初始化 Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });

// 寫入假期資料函數
export async function updateVacation(groupId, month, displayName, userId, vacationText) {
  const range = '工作表1!A2:E';
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range
  });

  const rows = res.data.values || [];
  const lowerMonth = month.trim();
  const matchedIndex = rows.findIndex(row => row[0] === groupId && row[1] === lowerMonth && row[3] === userId);

  // 已存在資料：若內容變更則更新
  if (matchedIndex !== -1) {
    const current = rows[matchedIndex][4] || '';
    if (current === vacationText) return 'same';

    const updateRange = `工作表1!E${matchedIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: updateRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[vacationText]]
      }
    });
    return 'updated';
  }

  // 不存在則新增
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
