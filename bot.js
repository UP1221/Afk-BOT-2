const mineflayer = require('mineflayer');

const HOST = process.env.MC_HOST || 'maxwol.mcsh.gg';
const PORT = Number(process.env.MC_PORT || 25565);
const USERNAME = process.env.BOT_USERNAME || 'MaxwolHelper';
const AUTH = process.env.MC_AUTH || 'offline';
const RECONNECT_MIN_MS = Number(process.env.RECONNECT_MIN_MS || 5000);
const RECONNECT_MAX_MS = Number(process.env.RECONNECT_MAX_MS || 60000);
const RESPAWN_DELAY_MS = Number(process.env.RESPAWN_DELAY_MS || 1500);

let bot;
let reconnectTimer;
let respawnTimer;
let reconnectDelay = RECONNECT_MIN_MS;
let stopping = false;
let respawnPending = false;

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
    reconnectDelay = RECONNECT_MIN_MS;
    respawnPending = false;

    // Deliberately do not force jumps or movement. Repeated invalid_player_movement
    // kicks are best diagnosed with idle behavior before adding any movement.
    console.log('[bot] Staying idle; no artificial movement enabled.');
  });

  bot.on('death', () => {
    console.log('[bot] Died; requesting respawn...');
    if (respawnPending || stopping) return;
    respawnPending = true;

    clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => {
      if (stopping || !bot) return;
      try {
        bot.respawn();
        console.log('[bot] Respawn requested.');
      } catch (error) {
        console.error('[bot] Respawn request failed:', error.message);
      }
      setTimeout(() => { respawnPending = false; }, 5000);
    }, RESPAWN_DELAY_MS);
  });

  bot.on('kicked', reason => {
    let printable = reason;
    try {
      if (reason && typeof reason === 'object') printable = JSON.stringify(reason);
    } catch {}
    console.log('[bot] Kicked by server:', printable);
  });

  bot.on('error', error => {
    console.error('[bot] Connection error:', error.code || '', error.message);
  });

  bot.on('end', () => {
    console.log('[bot] Disconnected.');

    clearTimeout(respawnTimer);
    respawnTimer = null;
    respawnPending = false;

    if (stopping) return;

    clearTimeout(reconnectTimer);
    console.log(`[bot] Reconnecting in ${Math.round(reconnectDelay / 1000)} seconds...`);
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
  });
}

function shutdown() {
  stopping = true;
  clearTimeout(reconnectTimer);
  clearTimeout(respawnTimer);
  if (bot) bot.quit();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

connect();
