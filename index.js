const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(bodyParser.json());

// ========== ตั้งค่า LINE Bot ==========
const LINE_TOKEN = 'dH8P1oh9GQBtH0IJ3JBKcNe4aPzPRgTfmtjI3t2WDhe5uerlWcSCY4kyTSZYXtdr1XXqTLDKVxQmKuNbKnjQKZmzxP9LOMy+c92kMn+qvCVb9gANwsxzTAP9mrs1cmUAdDSCdDt44VID+WnImzqLKgdB04t89/1O/w1cDnyilFU=';

// ========== เก็บคำสั่งล่าสุด (สำหรับ ESP32 มาดึง) ==========
let lastCommand = null;

// ========== เก็บ User IDs ==========
const USER_FILE = './userIds.json';
let userIds = [];

try {
  if (fs.existsSync(USER_FILE)) {
    userIds = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
    console.log(`✅ Loaded ${userIds.length} user(s)`);
  }
} catch (err) {
  console.error('❌ Error loading users:', err.message);
}

function saveUserIds() {
  try {
    fs.writeFileSync(USER_FILE, JSON.stringify(userIds, null, 2));
  } catch (err) {
    console.error('❌ Error saving users:', err.message);
  }
}

function addUser(userId) {
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    saveUserIds();
    console.log(`➕ New user: ${userId}`);
  }
}

// ========== Routes ==========

// หน้าหลัก
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Smart Parcel Box</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #667eea; color: white; }
        h1 { font-size: 3em; }
      </style>
    </head>
    <body>
      <h1>✅ LINE Bot is running!</h1>
      <p>Smart Parcel Box System</p>
      <p>Users: ${userIds.length}</p>
      <p>Last Command: ${lastCommand || 'None'}</p>
    </body>
    </html>
  `);
});

// รับคำสั่งจาก LINE
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  
  const events = req.body.events;
  if (!events || events.length === 0) return;
  
  const event = events[0];
  
  if (event.type === 'message' && event.message && event.message.type === 'text') {
    const replyToken = event.replyToken;
    const text = event.message.text.trim().toUpperCase();
    const userId = event.source.userId;
    
    addUser(userId);
    
    let message = '';
    
    if (text === 'OPEN') {
      lastCommand = 'OPEN';
      message = '📦 ส่งคำสั่งเปิดกล่องแล้ว!';
      console.log('📨 Command: OPEN');
    } else if (text === 'CLOSE') {
      lastCommand = 'CLOSE';
      message = '🔒 ส่งคำสั่งปิดกล่องแล้ว!';
      console.log('📨 Command: CLOSE');
    } else if (text === 'STATUS') {
      message = `📊 สถานะ:\n• ผู้ใช้: ${userIds.length} คน\n• คำสั่งล่าสุด: ${lastCommand || 'ไม่มี'}`;
    } else {
      message = '💡 คำสั่งที่ใช้ได้:\n• OPEN - เปิดกล่อง\n• CLOSE - ปิดกล่อง\n• STATUS - ดูสถานะ';
    }
    
    await replyMessage(replyToken, message);
  }
});

// ESP32 เช็คคำสั่ง (ดึงคำสั่งล่าสุด)
app.get('/command', (req, res) => {
  if (lastCommand) {
    const cmd = lastCommand;
    lastCommand = null; // ล้างคำสั่งหลังส่งแล้ว
    console.log(`📤 Sent command to ESP32: ${cmd}`);
    res.send(cmd);
  } else {
    res.send(''); // ไม่มีคำสั่งใหม่
  }
});

// รับการแจ้งเตือนจาก ESP32
app.get('/sensor', async (req, res) => {
  res.send('OK');
  
  if (req.query.notify && userIds.length > 0) {
    const event = req.query.notify;
    let message = '';
    
    if (event === 'detected') {
      message = '🔔 มีพัสดุส่งมาถึงแล้ว!\n📦 กรุณามารับพัสดุ\n\n⏰ ' + new Date().toLocaleString('th-TH');
    } else if (event === 'removed') {
      message = '✅ พัสดุถูกหยิบออกแล้ว\n\n⏰ ' + new Date().toLocaleString('th-TH');
    }
    
    if (message) {
      console.log(`\n📤 Sending to ${userIds.length} user(s): ${event}`);
      
      for (const uid of userIds) {
        await pushMessage(uid, message);
      }
    }
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
    console.log(`✅ Pushed to ${uid}`);
  } catch (err) {
    console.error(`❌ Push error:`, err.message);
  }
}

// ========== Start Server ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║    🎉 Smart Parcel Box Server     ║`);
  console.log(`╠════════════════════════════════════╣`);
  console.log(`║  Port: ${PORT}                       ║`);
  console.log(`║  Users: ${userIds.length}                          ║`);
  console.log(`║  Adafruit IO: ❌ Disabled          ║`);
  console.log(`╚════════════════════════════════════╝\n`);
});
