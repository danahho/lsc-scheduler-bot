import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { updateVacation, getVacationByMonth, clearVacation } from './google-sheet.js';

dotenv.config();

const app = express();
app.use(express.json());

const CHANNEL_ACCESS_TOKEN = process.env.CHANNEL_ACCESS_TOKEN;
const BOT_USER_ID = process.env.BOT_USER_ID;

app.post('/webhook', async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue;

    const { source, message, replyToken } = event;
    const groupId = source.groupId || source.roomId || source.userId;
    const userId = source.userId;
    const userMessage = message.text.trim();
    
if (userMessage === '/測試mention') {
  await replyToLineWithMention(replyToken, '你好 @阿和 👋', [{
    index: 3,
    length: 3,
    userId: userId  // 這裡用觸發者自己的 ID
  }]);
  continue;
}
    // 幫助功能// 幫助功能
    if (userMessage === '/幫助') {if (userMessage === '/幫助') {
      await replyToLine(replyToken, `
📖 指令說明：
👉 記錄假期：@LSC排班助理 6/3, 6/7
👉 查詢當月：/休假 [月份]（例如：/休假 6）
👉 清除紀錄：/清除 [月份]（例如：/清除 6）
👉 顯示幫助：/幫助
      `.trim());
      continue;
    }

    // 查詢功能（支援月份 + mention）
    if (userMessage.startsWith('/休假')) {
      const parts = userMessage.split(' ');
      let month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      if (parts.length === 2 && /^\d{1,2}$/.test(parts[1])) {
        month = parts[1].padStart(2, '0');
      }

      const year = new Date().getFullYear();
      const monthText = `${year}-${month}`;
      const records = await getVacationByMonth(groupId, monthText);

      if (records.length === 0) {
        await replyToLine(replyToken, `📭 ${month} 月沒有任何記錄`);
      } else {
        let text = '';
        let mentionees = [];

        for (const r of records) {
          const nameTag = `@${r[2]}`;
          const line = `${nameTag}：${r[4]}\n`;
          const atIndex = text.length;
          text += line;

          mentionees.push({
            index: atIndex,
            length: nameTag.length,
            userId: r[3]
          });
        }

        await replyToLineWithMention(replyToken, `📅 ${month} 月排班記錄：\n` + text, mentionees);
      }
      continue;
    }

    // 清除功能
    if (userMessage.startsWith('/清除')) {
      const parts = userMessage.split(' ');
      if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) {
        await replyToLine(replyToken, '請輸入正確格式：/清除 6');
        continue;
      }

      const year = new Date().getFullYear();
      const monthText = `${year}-${parts[1].padStart(2, '0')}`;
      const result = await clearVacation(groupId, monthText, userId);
      const msg = result
        ? `🧹 已清除 ${monthText} 的假期紀錄`
        : `❌ 沒有找到 ${monthText} 的假期紀錄`;
      await replyToLine(replyToken, msg);
      continue;
    }

    // 判斷是否標記到 BOT
    const botMentioned = message.mentioned?.mentions?.some(m => m.userId === BOT_USER_ID)
      || userMessage.includes('@LSC排班助理');

    if (!botMentioned) continue;

    // 假期語法解析（不含「休假」兩字）
    const match = userMessage.match(/@?LSC排班助理\s+((?:\d{1,2}\/\d{1,2}(?:,\s*)?)*)/);
    if (!match) {
      await replyToLine(replyToken, '❗️請輸入正確格式：@LSC排班助理 6/3, 6/7');
      continue;
    }

    const dates = match[1].replace(/\s+/g, '').trim();
    if (!dates) {
      await replyToLine(replyToken, '請至少輸入一個日期，如：@LSC排班助理 6/3');
      continue;
    }

    // 取得使用者暱稱
    let name = '';
    try {
      const profile = await axios.get(`https://api.line.me/v2/bot/group/${groupId}/member/${userId}`, {
        headers: { Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}` }
      });
      name = profile.data.displayName;
    } catch {
      name = '未知使用者';
    }

    const now = new Date();
    const firstDate = dates.split(',')[0].trim();
    const [month] = firstDate.split('/');
    const year = now.getFullYear();
    const monthText = `${year}-${month.padStart(2, '0')}`;

    const result = await updateVacation(groupId, monthText, name, userId, dates);
    if (result === 'same') return;

    const msgText = result === 'updated'
      ? `✅ @${name} 的假期已更新為：${dates}`
      : `✅ 已為 @${name} 記錄假期：${dates}`;

    const mentionIndex = msgText.indexOf(`@${name}`);
    console.log(msgText); // 👈 印出訊息內容
    console.log('Mention index:', mentionIndex); // 👈 印出 index 位置

    await replyToLineWithMention(replyToken, msgText, [{
      index: mentionIndex,
      length: name.length + 1,
      userId
    }]);
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
    console.error('LINE 回覆錯誤：', error?.response?.data || error.message);
  }
}

async function replyToLineWithMention(replyToken, messageText, mentionees) {
  try {
    console.log('[🔍 mentionees]', JSON.stringify(mentionees, null, 2)); // 👈 額外印出 mention 資料
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken,
      messages: [{
        type: 'text',
        text: messageText,
        mention: { mentionees }
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('LINE mention 回覆錯誤：', error?.response?.data || error.message);
  }
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 LSC排班助理運行中，http://localhost:${PORT}`);
});
