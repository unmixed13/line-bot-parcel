const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const LINE_TOKEN = 'dH8P1oh9GQBtH0IJ3JBKcNe4aPzPRgTfmtjI3t2WDhe5uerlWcSCY4kyTSZYXtdr1XXqTLDKVxQmKuNbKnjQKZmzxP9LOMy+c92kMn+qvCVb9gANwsxzTAP9mrs1cmUAdDSCdDt44VID+WnImzqLKgdB04t89/1O/w1cDnyilFU=';
const ADA_USER = 'smart_box_01';
const ADA_KEY = 'aio_zNUe82LUvGmHURACFwo2QKfHA808';
const FEED_CMD = 'parcel-box-cmd';
const FEED_NOTIFY = 'parcel-box-notify';

let userId = null;

app.get('/', (req, res) => {
  res.send('✅ LINE Bot is running!');
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  
  const events = req.body.events;
  if (!events || events.length === 0) return;
  
  const event = events[0];
  
  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const replyToken = event.replyToken;
    const text = event.message.text.trim().toUpperCase();
    userId = event.source.userId;
    
    let message = '';
    
    if (text === 'OPEN') {
      await sendToAdafruit(FEED_CMD, 1);
      message = '📦 เปิดกล่องเรียบร้อย!';
    } else if (text === 'CLOSE') {
      await sendToAdafruit(FEED_CMD, 0);
      message = '🔒 ปิดกล่องเรียบร้อย!';
    } else if (text === 'STATUS') {
      const status = await getFromAdafruit(FEED_NOTIFY);
      message = `📊 สถานะ: ${status}`;
    } else {
      message = '💡 คำสั่ง: OPEN / CLOSE / STATUS';
    }
    
    await replyMessage(replyToken, message);
  }
});

app.get('/sensor', async (req, res) => {
  res.send('OK');
  if (req.query.notify && userId) {
    await pushMessage(userId, `📦 พัสดุเข้ากล่อง! ${req.query.notify}`);
  }
});

async function replyMessage(replyToken, text) {
  try {
    await axios.post('https://api.line.me/v2/bot/message/reply', {
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    }, {
      headers: {
        'Authorization': `Bearer ${LINE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Reply error:', err.message);
  }
}

async function pushMessage(uid, text) {
  try {
    await axios.post('https://api.line.me/v2/bot/message/push', {
      to: uid,
      messages: [{ type: 'text', text: text }]
    }, {
      headers: {
        'Authorization': `Bearer ${LINE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Push error:', err.message);
  }
}

async function sendToAdafruit(feed, value) {
  try {
    await axios.post(
      `https://io.adafruit.com/api/v2/${ADA_USER}/feeds/${feed}/data`,
      { value: value },
      { headers: { 'X-AIO-Key': ADA_KEY, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Adafruit send error:', err.message);
  }
}

async function getFromAdafruit(feed) {
  try {
    const res = await axios.get(
      `https://io.adafruit.com/api/v2/${ADA_USER}/feeds/${feed}/data/last`,
      { headers: { 'X-AIO-Key': ADA_KEY } }
    );
    return res.data.value || 'ไม่มีข้อมูล';
  } catch (err) {
    return 'ไม่สามารถดึงข้อมูลได้';
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
