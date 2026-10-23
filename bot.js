const mineflayer = require('mineflayer');

const HOST = process.env.MC_HOST || 'maxwol.mcsh.gg';
const PORT = Number(process.env.MC_PORT || 25565);
const USERNAME = process.env.BOT_USERNAME || 'MaxwolHelper';
const AUTH = process.env.MC_AUTH || 'offline';

// Tune these in Render environment variables if needed.
const MOVE_INTERVAL_MS = Number(process.env.MOVE_INTERVAL_MS || 45000);
const RESPAWN_DELAY_MS = Number(process.env.RESPAWN_DELAY_MS || 1500);

let bot;
let reconnectTimer;
let movementTimer;
let respawnTimer;
let reconnectDelay = 5000;
let stopping = false;
let respawnPending = false;

function clearBotTimers() {
  clearInterval(movementTimer);
  clearTimeout(respawnTimer);
  movementTimer = null;
  respawnTimer = null;
  respawnPending = false;
}

function startAntiAfkMovement() {
  clearInterval(movementTimer);

  movementTimer = setInterval(() => {
    if (!bot || !bot.entity || stopping) return;

    // Short jump pulse; this may not satisfy every server's AFK rules.
    bot.setControlState('jump', true);
    setTimeout(() => {
      if (bot && bot.entity && !stopping) {
        bot.setControlState('jump', false);
      }
    }, 300);
  }, MOVE_INTERVAL_MS);
}

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
    console.log(`[bot] Online as ${bot.username}.`);
    reconnectDelay = 5000;
    respawnPending = false;
    startAntiAfkMovement();
  });

  bot.on('death', () => {
    console.log('[bot] Died; attempting to respawn...');
    if (respawnPending || stopping) return;
    respawnPending = true;

    respawnTimer = setTimeout(() => {
      if (stopping || !bot) return;
      try {
        bot.respawn();
        console.log('[bot] Respawn requested.');
      } catch (error) {
        console.error('[bot] Respawn request failed:', error.message);
      }
      // Allow another attempt if the server does not emit spawn promptly.
      setTimeout(() => { respawnPending = false; }, 5000);
    }, RESPAWN_DELAY_MS);
  });

  bot.on('kicked', reason => {
    console.log('[bot] Kicked by server:', reason);
  });

  bot.on('error', error => {
    console.error('[bot] Connection error:', error.message);
  });

  bot.on('end', () => {
    console.log('[bot] Disconnected.');
    clearBotTimers();

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
  clearBotTimers();
  if (bot) bot.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

connect();
