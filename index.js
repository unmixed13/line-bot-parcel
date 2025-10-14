const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(bodyParser.json());

// ========== ตั้งค่า ==========
const LINE_TOKEN = 'dH8P1oh9GQBtH0IJ3JBKcNe4aPzPRgTfmtjI3t2WDhe5uerlWcSCY4kyTSZYXtdr1XXqTLDKVxQmKuNbKnjQKZmzxP9LOMy+c92kMn+qvCVb9gANwsxzTAP9mrs1cmUAdDSCdDt44VID+WnImzqLKgdB04t89/1O/w1cDnyilFU=';
const ADA_USER = 'smart_box_01';
const ADA_KEY = 'aio_zNUe82LUvGmHURACFwo2QKfHA808';
const FEED_CMD = 'parcel-box-cmd';
const FEED_NOTIFY = 'parcel-box-notify';

// ========== บันทึก/โหลด User IDs ==========
const USER_FILE = './userIds.json';

// โหลด userIds จากไฟล์ (ถ้ามี)
let userIds = [];
try {
  if (fs.existsSync(USER_FILE)) {
    const data = fs.readFileSync(USER_FILE, 'utf8');
    userIds = JSON.parse(data);
    console.log(`✅ Loaded ${userIds.length} user(s) from file`);
  }
} catch (err) {
  console.error('❌ Error loading users:', err.message);
}

// บันทึก userIds ลงไฟล์
function saveUserIds() {
  try {
    fs.writeFileSync(USER_FILE, JSON.stringify(userIds, null, 2));
    console.log(`💾 Saved ${userIds.length} user(s) to file`);
  } catch (err) {
    console.error('❌ Error saving users:', err.message);
  }
}

// เพิ่ม userId ใหม่ (ถ้ายังไม่มี)
function addUser(userId) {
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    saveUserIds();
    console.log(`➕ New user added: ${userId}`);
    return true;
  }
  return false;
}

// ========== Routes ==========
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
    const userId = event.source.userId;
    
    // เพิ่ม user เข้าระบบ
    addUser(userId);
    
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

// Sensor แจ้งเตือน → ส่งหาทุกคน
app.get('/sensor', async (req, res) => {
  res.send('OK');
  
  if (req.query.notify) {
    const notifyMessage = `🔔 มีพัสดุส่งมาถึงแล้ว!\n📦 กรุณามารับพัสดุที่กล่อง Smart Parcel Box\n\n⏰ ${new Date().toLocaleString('th-TH')}`;
    
    console.log(`\n📤 Sending notification to ${userIds.length} user(s)...`);
    
    // ส่งหาทุกคนในระบบ
    for (const uid of userIds) {
      await pushMessage(uid, notifyMessage);
    }
    
    console.log('✅ Notification sent to all users');
  }
});

// ========== LINE Functions ==========
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
    console.log('✅ Reply sent');
  } catch (err) {
    console.error('❌ Reply error:', err.message);
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
    console.log(`✅ Push sent to ${uid}`);
  } catch (err) {
    console.error(`❌ Push error to ${uid}:`, err.message);
  }
}

// ========== Adafruit Functions ==========
async function sendToAdafruit(feed, value) {
  try {
    await axios.post(
      `https://io.adafruit.com/api/v2/${ADA_USER}/feeds/${feed}/data`,
      { value: value },
      { headers: { 'X-AIO-Key': ADA_KEY, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Sent to Adafruit: ${feed} = ${value}`);
  } catch (err) {
    console.error('❌ Adafruit send error:', err.message);
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
    console.error('❌ Adafruit get error:', err.message);
    return 'ไม่สามารถดึงข้อมูลได้';
  }
}

// ========== Start Server ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║  ✅ Server running on port ${PORT}  ║`);
  console.log(`║  👥 Users loaded: ${userIds.length}              ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});
