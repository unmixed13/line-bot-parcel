// adafruit.js — optional Adafruit IO integration (not wired into index.js by default)
const axios = require('axios');
const config = require('./config');

const client = axios.create({
  baseURL: 'https://io.adafruit.com/api/v2',
  timeout: 8000,
});

function isConfigured() {
  return Boolean(config.adafruit.username && config.adafruit.key);
}

// ส่งค่าไป Adafruit feed
async function sendToAdafruit(feed, value) {
  if (!isConfigured()) {
    console.warn('⚠️  Adafruit IO not configured (ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY); skipping send.');
    return;
  }
  try {
    const res = await client.post(
      `/${config.adafruit.username}/feeds/${feed}/data`,
      { value },
      { headers: { 'X-AIO-Key': config.adafruit.key, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Sent to Adafruit [${feed}]:`, value, res.data);
  } catch (err) {
    console.error(`❌ Adafruit send error [${feed}]:`, err.response?.status, err.response?.data || err.message);
  }
}

// ดึงค่า feed ล่าสุดจาก Adafruit
async function getFromAdafruit(feed) {
  if (!isConfigured()) {
    console.warn('⚠️  Adafruit IO not configured (ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY); skipping fetch.');
    return 'ไม่สามารถดึงข้อมูลได้';
  }
  try {
    const res = await client.get(`/${config.adafruit.username}/feeds/${feed}/data/last`, {
      headers: { 'X-AIO-Key': config.adafruit.key },
    });
    console.log(`✅ Adafruit response [${feed}]:`, res.data);
    return res.data.value || 'ไม่มีข้อมูล';
  } catch (err) {
    console.error(`❌ Adafruit get error [${feed}]:`, err.response?.status, err.response?.data || err.message);
    return 'ไม่สามารถดึงข้อมูลได้';
  }
}

module.exports = { sendToAdafruit, getFromAdafruit };
