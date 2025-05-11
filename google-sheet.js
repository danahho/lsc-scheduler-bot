// google-sheet.js
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheetId = process.env.GOOGLE_SHEET_ID;
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

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

  // 如果已有資料，檢查是否內容變動
  if (matchedIndex !== -1) {
    const current = rows[matchedIndex][4] || '';
    if (current === vacationText) return 'same';

    // 更新資料
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

  // 沒有找到就新增一列
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

// 👉（後續我們也會加 getVacationByMonth 來查詢休假）
