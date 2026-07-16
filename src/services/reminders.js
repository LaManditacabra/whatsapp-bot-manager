import cron from 'node-cron';
import db from '../database/db.js';
import logger from '../utils/logger.js';

export function startReminderService(sock) {
  cron.schedule('* * * * *', async () => {
    try {
      const now = db.fn.now();
      const reminders = await db('reminders')
        .where('sent', false)
        .where('scheduled_at', '<=', now);

      for (const reminder of reminders) {
        try {
          await sock.sendMessage(reminder.user_id, {
            text: `⏰ *Recordatorio*\n\n${reminder.message}`,
          });

          await db('reminders')
            .where('id', reminder.id)
            .update({ sent: true, sent_at: db.fn.now() });

          logger.info({ reminderId: reminder.id }, 'Recordatorio enviado');
        } catch (err) {
          logger.error({ err, reminderId: reminder.id }, 'Error enviando recordatorio');
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error en servicio de recordatorios');
    }
  });

  logger.info('Servicio de recordatorios iniciado');
}
