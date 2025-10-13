// adafruit.js
const axios = require('axios');

const ADA_USER = 'smart_box_01';
const ADA_KEY = 'aio_zNUe82LUvGmHURACFwo2QKfHA808';

// ส่งค่าไป Adafruit feed
async function sendToAdafruit(feed, value) {
  try {
    const res = await axios.post(
      `https://io.adafruit.com/api/v2/${ADA_USER}/feeds/${feed}/data`,
      { value },
      { headers: { 'X-AIO-Key': ADA_KEY, 'Content-Type': 'application/json' } }
    );
    console.log(`✅ Sent to Adafruit [${feed}]:`, value, res.data);
  } catch (err) {
    console.error(`❌ Adafruit send error [${feed}]:`, err.response?.status, err.response?.data || err.message);
  }
}

// ดึงค่า feed ล่าสุดจาก Adafruit
async function getFromAdafruit(feed) {
  try {
    const res = await axios.get(
      `https://io.adafruit.com/api/v2/${ADA_USER}/feeds/${feed}/data/last`,
      { headers: { 'X-AIO-Key': ADA_KEY } }
    );
    console.log(`✅ Adafruit response [${feed}]:`, res.data);
    return res.data.value || 'ไม่มีข้อมูล';
  } catch (err) {
    console.error(`❌ Adafruit get error [${feed}]:`, err.response?.status, err.response?.data || err.message);
    return 'ไม่สามารถดึงข้อมูลได้';
  }
}

module.exports = { sendToAdafruit, getFromAdafruit };
