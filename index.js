// index.js
import express from 'express';
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { updateVacation } from './google-sheet.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const BOT_USER_ID = process.env.BOT_USER_ID; // 可選

app.post('/webhook', async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const { source, message, replyToken } = event;
      const groupId = source.groupId || source.roomId || source.userId;
      const userId = source.userId;
      const userMessage = message.text.trim();

      // 檢查是否提到 BOT
      const botMentioned = message.mentioned?.mentions?.some(m => m.userId === BOT_USER_ID)
        || userMessage.includes('@LSC排班助理');

      if (!botMentioned) continue;

      // 擷取假期資料
      const match = userMessage.match(/@?LSC排班助理\s+(.*?)(\d{1,2}\/\d{1,2}(?:,\s*\d{1,2}\/\d{1,2})*)\s*(休假|休)?/);
      if (!match) {
        await replyToLine(replyToken, '請輸入正確格式，例如：@LSC排班助理 6/3, 6/7 休假');
        continue;
      }

      let name = match[1].trim();
      const dates = match[2].trim();

      // 若未指定名字，用 LINE displayName 查詢
      if (!name || /\d/.test(name)) {
        try {
          const profile = await axios.get(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
            headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` }
          });
          name = profile.data.displayName;
        } catch {
          name = '未知使用者';
        }
      }

      // 計算月份 yyyy-mm
      const now = new Date();
      const firstDate = dates.split(',')[0].trim();
      const [month] = firstDate.split('/');
      const year = now.getFullYear();
      const monthText = `${year}-${month.padStart(2, '0')}`;

      // 寫入 Google Sheet
      const result = await updateVacation(groupId, monthText, name, userId, dates);

      if (result === 'same') return;

      const msg = result === 'updated'
        ? `✅ @${name} 的假期已更新為：${dates}`
        : `✅ 已為 @${name} 記錄假期：${dates}`;

      await replyToLine(replyToken, msg);
    }
  }

  res.send('OK');
});

async function replyToLine(replyToken, message) {
  try {
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken,
      messages: [{ type: 'text', text: message }]
    }, {
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('LINE 回覆錯誤：', error);
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 LSC排班助理運行中，http://localhost:${PORT}`);
});
