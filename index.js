const express = require('express');
const bodyParser = require('body-parser');

const { sendToAdafruit, getFromAdafruit } = require('./adafruit');
const { replyMessage, pushMessage } = require('./line');

const app = express();
app.use(bodyParser.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
