import config from '../config/index.js';
import help from './help.js';
import menu from './menu.js';
import horario from './horario.js';
import contacto from './contacto.js';
import pedido from './pedido.js';

const PREFIX = config.bot.prefix;
const PREFIX_LEN = PREFIX.length;

const commands = new Map();

export function register(cmd, handler) {
  commands.set(cmd, handler);
}

export async function handle(sock, msg, text) {
  if (!text.startsWith(PREFIX)) return false;

  const parts = text.slice(PREFIX_LEN).trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const handler = commands.get(cmd);
  if (!handler) return false;

  await handler(sock, msg, args);
  return true;
}

export async function execute(sock, msg, cmdName, args = []) {
  const handler = commands.get(cmdName);
  if (!handler) return false;
  await handler(sock, msg, args);
  return true;
}

register('help', help);
register('productos', menu);
register('horario', horario);
register('contacto', contacto);
register('pedido', pedido);
