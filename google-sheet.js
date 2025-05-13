import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const sheetId = process.env.GOOGLE_SHEET_ID;
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_RANGE = '工作表1!A2:E';  // 共用範圍

// ✅ 新增或更新假期
export async function updateVacation(groupId, month, displayName, userId, vacationText) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: SHEET_RANGE
    });

    const rows = res.data.values || [];
    const matchedIndex = rows.findIndex(
      row => row[0] === groupId && row[1] === month && row[3] === userId
    );

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
        values: [[groupId, month, displayName, userId, vacationText]]
      }
    });

    return 'new';

  } catch (err) {
    console.error('❌ updateVacation 錯誤：', err);
    throw err;
  }
}

// ✅ 查詢群組該月所有假期
export async function getVacationByMonth(groupId, month) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: SHEET_RANGE
    });

    const rows = res.data.values || [];
    return rows.filter(row =>
      row[0] === groupId && row[1] === month && row[4] // 第 5 欄不為空
    );

  } catch (err) {
    console.error('❌ getVacationByMonth 錯誤：', err);
    throw err;
  }
}

// ✅ 清除該月假期
export async function clearVacation(groupId, month, userId) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: SHEET_RANGE
    });

    const rows = res.data.values || [];
    const matchedIndex = rows.findIndex(
      row => row[0] === groupId && row[1] === month && row[3] === userId
    );

    if (matchedIndex === -1) return false;

    const clearRange = `工作表1!E${matchedIndex + 2}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: clearRange,
      valueInputOption: 'RAW',
      requestBody: { values: [['']] }
    });

    return true;

  } catch (err) {
    console.error('❌ clearVacation 錯誤：', err);
    throw err;
  }
}
