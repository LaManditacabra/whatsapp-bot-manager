import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

export default {
  bot: {
    name: process.env.BOT_NAME || 'MiBot',
    prefix: process.env.BOT_PREFIX || '!',
    cooldown: parseInt(process.env.BOT_COOLDOWN || '172800', 10),
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'whatsapp_bot',
    user: process.env.DB_USER || 'bot',
    password: process.env.DB_PASSWORD || 'changeme',
  },
  apis: {
    weather: process.env.WEATHER_API_KEY || '',
    news: process.env.NEWS_API_KEY || '',
  },
  paths: {
    auth: process.env.AUTH_DIR || './auth',
  },
};
