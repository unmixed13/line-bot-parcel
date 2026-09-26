// line.js
const axios = require('axios');
const crypto = require('crypto');
const config = require('./config');

const client = axios.create({
  baseURL: 'https://api.line.me/v2/bot/message',
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${config.line.channelAccessToken}`,
    'Content-Type': 'application/json',
  },
});

// ส่งข้อความตอบกลับ LINE
async function replyMessage(replyToken, text) {
  try {
    await client.post('/reply', { replyToken, messages: [{ type: 'text', text }] });
    console.log('✅ Replied to LINE:', text);
  } catch (err) {
    console.error('❌ LINE reply error:', err.response?.status, err.response?.data || err.message);
  }
}

// ส่งข้อความ push LINE
async function pushMessage(uid, text) {
  try {
    await client.post('/push', { to: uid, messages: [{ type: 'text', text }] });
    console.log('✅ Pushed LINE message:', text);
  } catch (err) {
    console.error('❌ LINE push error:', err.response?.status, err.response?.data || err.message);
  }
}

// ตรวจลายเซ็น X-Line-Signature เพื่อยืนยันว่า webhook มาจาก LINE จริง
// คืนค่า true ทันทีถ้าไม่ได้ตั้ง LINE_CHANNEL_SECRET ไว้ (มี warning ตอนบูตแล้ว)
function isValidSignature(rawBody, signature) {
  if (!config.line.channelSecret) return true;
  if (!signature || !rawBody) return false;

  const expected = crypto
    .createHmac('sha256', config.line.channelSecret)
    .update(rawBody)
    .digest('base64');

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(signature);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = { replyMessage, pushMessage, isValidSignature };
