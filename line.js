// line.js
const axios = require('axios');

const LINE_TOKEN = 'dH8P1oh9GQBtH0IJ3JBKcNe4aPzPRgTfmtjI3t2WDhe5uerlWcSCY4kyTSZYXtdr1XXqTLDKVxQmKuNbKnjQKZmzxP9LOMy+c92kMn+qvCVb9gANwsxzTAP9mrs1cmUAdDSCdDt44VID+WnImzqLKgdB04t89/1O/w1cDnyilFU=';

// ส่งข้อความตอบกลับ LINE
async function replyMessage(replyToken, text) {
  try {
    const res = await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      { replyToken, messages: [{ type: 'text', text }] },
      { headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log('✅ Replied to LINE:', text);
  } catch (err) {
    console.error('❌ LINE reply error:', err.response?.status, err.response?.data || err.message);
  }
}

// ส่งข้อความ push LINE
async function pushMessage(uid, text) {
  try {
    const res = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to: uid, messages: [{ type: 'text', text }] },
      { headers: { 'Authorization': `Bearer ${LINE_TOKEN}`, 'Content-Type': 'application/json' } }
    );
    console.log('✅ Pushed LINE message:', text);
  } catch (err) {
    console.error('❌ LINE push error:', err.response?.status, err.response?.data || err.message);
  }
}

module.exports = { replyMessage, pushMessage };
