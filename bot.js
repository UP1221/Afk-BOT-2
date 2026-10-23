const mineflayer = require('mineflayer');

const HOST = process.env.MC_HOST || 'maxwol.mcsh.gg';
const PORT = Number(process.env.MC_PORT || 25565);
const USERNAME = process.env.BOT_USERNAME || 'MaxwolHelper';
const AUTH = process.env.MC_AUTH || 'offline';

let bot;
let reconnectTimer;
let movementTimer;
let reconnectDelay = 5000;
let stopping = false;

function connect() {
  if (stopping) return;

  console.log(`[bot] Connecting to ${HOST}:${PORT} as ${USERNAME}...`);

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    auth: AUTH
  });

  bot.once('spawn', () => {
    console.log(`[bot] Joined successfully as ${bot.username}.`);

    reconnectDelay = 5000;
    clearInterval(movementTimer);

    // Brief movement every 60 seconds. Server rules may prohibit AFK bots.
    movementTimer = setInterval(() => {
      if (!bot || !bot.entity) return;

      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot && bot.entity) bot.setControlState('jump', false);
      }, 300);
    }, 60000);
  });

  bot.on('kicked', reason => {
    console.log('[bot] Kicked by server:', reason);
  });

  bot.on('error', error => {
    console.error('[bot] Connection error:', error.message);
  });

  bot.on('end', () => {
    console.log('[bot] Disconnected.');

    clearInterval(movementTimer);
    movementTimer = null;

    if (stopping) return;

    clearTimeout(reconnectTimer);
    console.log(`[bot] Reconnecting in ${Math.round(reconnectDelay / 1000)} seconds...`);
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  });
}

function shutdown() {
  stopping = true;
  clearTimeout(reconnectTimer);
  clearInterval(movementTimer);
  if (bot) bot.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

connect();
