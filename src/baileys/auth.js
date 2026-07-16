import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const AUTH_DIR = config.paths.auth;

if (!existsSync(AUTH_DIR)) {
  mkdirSync(AUTH_DIR, { recursive: true });
}

export function getAuthState() {
  const credsPath = join(AUTH_DIR, 'creds.json');

  const creds = existsSync(credsPath)
    ? JSON.parse(readFileSync(credsPath, 'utf-8'))
    : null;

  const keys = {};

  return {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {};
        for (const id of ids) {
          const keyPath = join(AUTH_DIR, `${type}-${id}.json`);
          if (existsSync(keyPath)) {
            data[id] = JSON.parse(readFileSync(keyPath, 'utf-8'));
          }
        }
        return data;
      },
      set: async (data) => {
        for (const id in data) {
          const keyPath = join(AUTH_DIR, `${data[id].type}-${id}.json`);
          writeFileSync(keyPath, JSON.stringify(data[id]));
        }
      },
    },
    saveCreds: async (newCreds) => {
      writeFileSync(credsPath, JSON.stringify(newCreds, null, 2));
      logger.info('Credenciales de WhatsApp guardadas');
    },
    clear: async () => {
      if (existsSync(credsPath)) unlinkSync(credsPath);
      logger.info('Sesión de WhatsApp eliminada');
    },
  };
}
