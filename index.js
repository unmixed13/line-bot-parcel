const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const fs = require('fs');

const config = require('./config');
const line = require('./line');

const app = express();

// อยู่หลัง reverse proxy ของ Render เสมอ — ต้องตั้งค่านี้เพื่อให้ req.ip / rate
// limiter อ่าน IP จริงของผู้เรียกจาก X-Forwarded-For แทน IP ของ proxy เอง
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  express.json({
    limit: '256kb',
    verify: (req, res, buf) => {
      req.rawBody = buf; // เก็บ raw body ไว้ตรวจลายเซ็น LINE
    },
  })
);

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
    // เขียนไฟล์ชั่วคราวแล้ว rename ทับ — กัน userIds.json เสียหาย
    // ถ้าโปรเซสถูก kill กลางคันระหว่างเขียน
    const tmpFile = `${USER_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(userIds, null, 2));
    fs.renameSync(tmpFile, USER_FILE);
  } catch (err) {
    console.error('❌ Error saving users:', err.message);
  }
}

function addUser(userId) {
  if (userId && !userIds.includes(userId)) {
    userIds.push(userId);
    saveUserIds();
    console.log(`➕ New user: ${userId}`);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// ========== ตรวจ API key สำหรับ endpoint ฝั่งฮาร์ดแวร์ ==========
// ถ้าไม่ได้ตั้ง DEVICE_API_KEY ไว้ endpoint จะเปิดโล่งเหมือนเดิม (มี warning ตอนบูต)
function requireDeviceApiKey(req, res, next) {
  if (!config.deviceApiKey) return next();

  const provided = req.get('x-api-key') || req.query.key;
  if (!provided) return res.status(401).send('Missing API key');

  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(config.deviceApiKey);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).send('Invalid API key');
  }
  next();
}

const hardwareLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.hardwareMax,
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.webhookMax,
  standardHeaders: true,
  legacyHeaders: false,
});

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
      <p>Last Command: ${escapeHtml(lastCommand || 'None')}</p>
    </body>
    </html>
  `);
});

// Health check (สำหรับ uptime monitor / Render health check)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

async function handleLineEvent(event) {
  if (event.type !== 'message' || !event.message || event.message.type !== 'text') return;

  const replyToken = event.replyToken;
  const text = event.message.text.trim().toUpperCase();
  const userId = event.source && event.source.userId;

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

  await line.replyMessage(replyToken, message);
}

// รับคำสั่งจาก LINE
app.post('/webhook', webhookLimiter, (req, res, next) => {
  const signature = req.get('x-line-signature');
  if (!line.isValidSignature(req.rawBody, signature)) {
    console.warn('⚠️  Rejected /webhook request: invalid X-Line-Signature');
    return res.sendStatus(401);
  }
  next();
}, async (req, res) => {
  res.sendStatus(200);

  const events = req.body && req.body.events;
  if (!Array.isArray(events) || events.length === 0) return;

  for (const event of events) {
    try {
      await handleLineEvent(event);
    } catch (err) {
      console.error('❌ Error handling LINE event:', err.message);
    }
  }
});

// ESP32 เช็คคำสั่ง (ดึงคำสั่งล่าสุด)
app.get('/command', hardwareLimiter, requireDeviceApiKey, (req, res) => {
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
app.get('/sensor', hardwareLimiter, requireDeviceApiKey, async (req, res) => {
  res.send('OK');

  const event = req.query.notify;
  if ((event === 'detected' || event === 'removed') && userIds.length > 0) {
    let message = '';

    if (event === 'detected') {
      message = '🔔 มีพัสดุส่งมาถึงแล้ว!\n📦 กรุณามารับพัสดุ\n\n⏰ ' + new Date().toLocaleString('th-TH');
    } else {
      message = '✅ พัสดุถูกหยิบออกแล้ว\n\n⏰ ' + new Date().toLocaleString('th-TH');
    }

    console.log(`\n📤 Sending to ${userIds.length} user(s): ${event}`);
    for (const uid of userIds) {
      await line.pushMessage(uid, message);
    }
  }
});

// จับ JSON body ที่ parse ไม่ผ่าน และ error อื่น ๆ ที่หลุดมาจาก route handler
// ต้องอยู่หลังสุด (error-handling middleware ของ Express ต้องมี 4 arguments)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    console.warn('⚠️  Malformed JSON body received on', req.path);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== Start Server ==========
const server = app.listen(config.port, () => {
  console.log(`\n╔════════════════════════════════════╗`);
  console.log(`║    🎉 Smart Parcel Box Server     ║`);
  console.log(`╠════════════════════════════════════╣`);
  console.log(`║  Port: ${config.port}`);
  console.log(`║  Users: ${userIds.length}`);
  console.log(`║  LINE signature check: ${config.line.channelSecret ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`║  Device API key: ${config.deviceApiKey ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`╚════════════════════════════════════╝\n`);
});

// ========== Graceful shutdown & crash safety ==========
function shutdown(signal) {
  console.log(`\n${signal} received: closing server gracefully...`);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
  // กันเหนียว เผื่อ connection ค้างไม่ยอมปิด
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});
