import logger from './utils/logger.js';
import { connect } from './baileyes-client.js';
import { processMessage } from './handlers/index.js';
import { startReminderService } from './services/reminders.js';
import db from './database/db.js';
import './commands/index.js';

async function runMigrations() {
  try {
    logger.info('Ejecutando migraciones de base de datos...');
    await db.migrate.latest();
    logger.info('Migraciones ejecutadas correctamente');
  } catch (err) {
    logger.error({ err }, 'Error ejecutando migraciones');
    throw err;
  }
}

async function main() {
  logger.info('Iniciando bot de WhatsApp...');

  try {
    await runMigrations();

    const sock = await connect({ processMessage });

    startReminderService(sock);

    const shutdown = async () => {
      logger.info('Deteniendo bot...');
      sock?.end();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    logger.info('Bot iniciado correctamente');
  } catch (err) {
    logger.error({ err }, 'Error fatal al iniciar el bot');
    process.exit(1);
  }
}

main();
