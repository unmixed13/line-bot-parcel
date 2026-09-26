require('dotenv').config();

const REQUIRED_VARS = ['LINE_CHANNEL_ACCESS_TOKEN'];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
  console.error("   Set them in a .env file (see .env.example) or your host's environment settings.");
  process.exit(1);
}

if (!process.env.LINE_CHANNEL_SECRET) {
  console.warn('⚠️  LINE_CHANNEL_SECRET is not set — /webhook requests will NOT be signature-verified.');
  console.warn('   Anyone who finds the webhook URL could send forged LINE events. Set LINE_CHANNEL_SECRET to fix this.');
}

if (!process.env.DEVICE_API_KEY) {
  console.warn('⚠️  DEVICE_API_KEY is not set — /command and /sensor are open to anyone who finds the URL.');
  console.warn('   Set DEVICE_API_KEY and send it from the ESP32 (header X-API-Key or ?key=) to lock these down.');
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 10000,
  nodeEnv: process.env.NODE_ENV || 'development',
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET || null,
  },
  adafruit: {
    username: process.env.ADAFRUIT_IO_USERNAME || null,
    key: process.env.ADAFRUIT_IO_KEY || null,
  },
  deviceApiKey: process.env.DEVICE_API_KEY || null,
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
    hardwareMax: parseInt(process.env.RATE_LIMIT_HARDWARE_MAX, 10) || 300,
    webhookMax: parseInt(process.env.RATE_LIMIT_WEBHOOK_MAX, 10) || 120,
  },
};
