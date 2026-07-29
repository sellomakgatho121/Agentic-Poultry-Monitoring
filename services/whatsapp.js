/**
 * Boonducks Farm WhatsApp/SMS Bot Service
 *
 * Delivers farm summaries, push alerts, and handles farmer queries
 * via Twilio WhatsApp API. Falls back to SMS for critical alerts.
 *
 * Usage:
 *   const bot = require('./services/whatsapp');
 *   await bot.sendDailySummary(farmData);        // Daily WhatsApp report
 *   await bot.sendAlert(alert, 'whatsapp');      // Push alert
 *   await bot.handleIncoming(message, from);     // Process farmer's text
 *
 * Requires .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *                TWILIO_WHATSAPP_NUMBER, FARMER_WHATSAPP
 */

const messagingClient = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  try {
    const twilio = require('twilio');
    return twilio(sid, token);
  } catch {
    return null;
  }
};

const client = messagingClient();

// ─── Format Helpers ─────────────────────────────────────────────────────────

function formatTemp(temp) {
  return `${temp}°C`;
}

function tempEmoji(temp) {
  if (temp > 32) return '🔥';
  if (temp > 28) return '⚠️';
  return '✅';
}

function stressEmoji(level) {
  if (level > 0.6) return '🔴';
  if (level > 0.35) return '🟡';
  return '🟢';
}

function formatAlert(alert) {
  const levelIcon = alert.level === 'danger' ? '🚨' : '⚠️';
  return (
    `${levelIcon} *${alert.title}*\n` +
    `📍 Coop: ${alert.coop}\n` +
    `📝 ${alert.message}\n` +
    `🕐 ${new Date().toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg' })}`
  );
}

// ─── Message Sender ─────────────────────────────────────────────────────────

async function send(to, body) {
  if (!client) {
    console.log('[WhatsApp Bot] Twilio not configured — would send:', body.substring(0, 80) + '...');
    return { simulated: true, body: body.substring(0, 80) };
  }
  const from = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  try {
    const msg = await client.messages.create({ from, to, body });
    console.log(`[WhatsApp Bot] Sent to ${to}: ${msg.sid}`);
    return { success: true, sid: msg.sid };
  } catch (err) {
    console.error('[WhatsApp Bot] Send failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a daily farm summary WhatsApp message
 * @param {Object} data - { liveTelemetry[], liveStress[], financials, alerts }
 */
async function sendDailySummary(data) {
  const farmer = process.env.FARMER_WHATSAPP;
  if (!farmer) {
    console.log('[WhatsApp Bot] No FARMER_WHATSAPP configured — skipping daily summary');
    return;
  }

  const { liveTelemetry, liveStress, financials, alerts } = data;
  const totalEggs = financials?.last30Days?.eggsProduced || 0;
  const revenue = financials?.last30Days?.revenue || 0;
  const activeAlerts = (alerts || []).filter(a => !a.resolved);

  let body = '🌅 *Boonducks Farm — Daily Report*\n';
  body += `📅 ${new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;

  body += '*🐔 Coop Overview*\n';
  (liveTelemetry || []).forEach(t => {
    const coop = data.coops?.find(c => c.id === t.coop_id);
    const stress = liveStress?.find(s => s.coop_id === t.coop_id);
    body += `${coop?.name || `Coop ${t.coop_id}`}: `;
    body += `${tempEmoji(t.temperature)} ${formatTemp(t.temperature)} `;
    body += `💧 ${t.humidity}% `;
    body += `${stressEmoji(stress?.acoustic_stress || 0)} ${Math.round((stress?.acoustic_stress || 0) * 100)}% stress\n`;
  });

  body += `\n*📊 Production (Last 30 Days)*\n`;
  body += `🥚 Eggs: ${totalEggs.toLocaleString()}\n`;
  body += `💰 Revenue: R${revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
  body += `🎯 Target: ${Math.round(financials?.last30Days?.percentOfTarget || 0)}%\n`;

  if (activeAlerts.length > 0) {
    body += `\n*🚨 Active Alerts: ${activeAlerts.length}*\n`;
    activeAlerts.slice(0, 3).forEach(a => {
      body += `• ${a.type === 'heat_stress' ? '🔥' : '💨'} ${a.coop_name}: ${a.message.substring(0, 60)}\n`;
    });
  }

  body += `\n_Reply with "help" for available commands_`;

  return send(farmer, body);
}

/**
 * Push an alert notification via WhatsApp (or SMS fallback)
 * @param {Object} alert - { title, coop, message, level, coop_id }
 * @param {'whatsapp'|'sms'} channel
 */
async function sendAlert(alert, channel = 'whatsapp') {
  const farmer = process.env.FARMER_WHATSAPP;
  const farmerPhone = process.env.FARMER_PHONE;
  if (!farmer && channel === 'whatsapp') {
    console.log('[WhatsApp Bot] No FARMER_WHATSAPP — SMS fallback');
    return sendAlert(alert, 'sms');
  }
  if (!farmerPhone && channel === 'sms') {
    console.log('[WhatsApp Bot] Neither WhatsApp nor SMS configured');
    return;
  }

  const recipient = channel === 'whatsapp' ? farmer : farmerPhone;
  const body = formatAlert(alert);
  return send(recipient, body);
}

/**
 * Handle an incoming message from the farmer
 * @param {string} message - The text the farmer sent
 * @param {string} from - The farmer's WhatsApp number
 * @returns {Promise<string>} Reply text
 */
async function handleIncoming(message, from) {
  const text = message.trim().toLowerCase();

  // Fetch current farm data from the running API
  let farmData = {};
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const [coops, telemetry, stress, financials, alerts] = await Promise.all([
      fetch(`${baseUrl}/api/coops`).then(r => r.json()),
      fetch(`${baseUrl}/api/telemetry/live`).then(r => r.json()),
      fetch(`${baseUrl}/api/stress/live`).then(r => r.json()),
      fetch(`${baseUrl}/api/financials`).then(r => r.json()),
      fetch(`${baseUrl}/api/alerts`).then(r => r.json()),
    ]);
    farmData = { coops, telemetry, stress, financials, alerts };
  } catch {
    farmData = {};
  }

  // ── Command Parsing ─────────────────────────────────────────────────
  if (text === 'help' || text === 'menu') {
    return (
      '*Boonducks Farm — Available Commands*\n\n' +
      '📋 `status` — All coop summary\n' +
      '🥚 `eggs` — Egg production & revenue\n' +
      '🚨 `alerts` — Active alerts\n' +
      '🐔 `coop [name]` — Specific coop details\n' +
      '🌡️ `temp [name]` — Temperature for a coop\n' +
      '📊 `report` — Full daily report');
  }

  if (text === 'status' || text === 'all') {
    const coops = farmData.coops || [];
    const telemetry = farmData.telemetry || [];
    const stress = farmData.stress || [];
    let reply = '*🐔 Boonducks Farm — Current Status*\n\n';
    coops.forEach(c => {
      const t = telemetry.find(x => x.coop_id === c.id);
      const s = stress.find(x => x.coop_id === c.id);
      if (t) {
        reply += `*${c.name}* (${c.type})\n`;
        reply += `  🌡 ${formatTemp(t.temperature)}  💧 ${t.humidity}%\n`;
        if (s) reply += `  ${stressEmoji(s.acoustic_stress)} ${Math.round(s.acoustic_stress * 100)}% stress 🐔 ${s.active_birds}/${s.bird_count}\n`;
        reply += '\n';
      }
    });
    return reply || 'No farm data available right now.';
  }

  if (text === 'eggs' || text === 'production') {
    const fin = farmData.financials?.last30Days;
    if (!fin) return 'Production data not available.';
    let reply = '*🥚 Egg Production — Last 30 Days*\n\n';
    reply += `Total eggs: ${fin.eggsProduced?.toLocaleString() || 0}\n`;
    reply += `🥚 Cracked: ${fin.cracked || 0}  |  Dirty: ${fin.dirty || 0}\n`;
    reply += `💰 Revenue: R${(fin.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    reply += `🛡 Revenue protected: R${(fin.revenueProtected || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
    reply += `🎯 ${Math.round(fin.percentOfTarget || 0)}% of monthly target`;
    return reply;
  }

  if (text === 'alerts' || text === 'alert') {
    const alerts = farmData.alerts || [];
    if (alerts.length === 0) return '✅ No active alerts. All coops operating normally.';
    let reply = `*🚨 Active Alerts: ${alerts.length}*\n\n`;
    alerts.forEach(a => {
      reply += `${a.type === 'heat_stress' ? '🔥' : '💨'} *${a.coop_name}*\n`;
      reply += `  ${a.message}\n`;
      if (a.mitigated) reply += `  ✅ Mitigated: ${a.mitigation}\n`;
      reply += '\n';
    });
    return reply;
  }

  // Coop-specific commands: "coop Cage A", "temp Cage A", "status Cage A"
  const coopMatch = text.match(/^(coop|temp|status)\s+(.+)/i);
  if (coopMatch) {
    const query = coopMatch[2].toLowerCase();
    const coops = farmData.coops || [];
    const coop = coops.find(c => c.name.toLowerCase().includes(query) || c.name.toLowerCase() === query || String(c.id) === query);
    if (!coop) return `❌ Could not find a coop matching "${coopMatch[2]}". Try: Cage Coop A, Cage Coop B, Litter Coop 1-6, or a coop number (1-8).`;

    const telemetry = farmData.telemetry || [];
    const stress = farmData.stress || [];
    const t = telemetry.find(x => x.coop_id === coop.id);
    const s = stress.find(x => x.coop_id === coop.id);
    const alerts = farmData.alerts || [];
    const alert = alerts.find(a => a.coop_id === coop.id);

    let reply = `*🐔 ${coop.name}*\n`;
    reply += `📋 Type: ${coop.type} | Capacity: ${coop.capacity}\n\n`;
    if (t) {
      reply += `🌡 Temperature: ${formatTemp(t.temperature)} ${tempEmoji(t.temperature)}\n`;
      reply += `💧 Humidity: ${t.humidity}%\n`;
      reply += `💨 NH₃: ${t.nh3_level} ppm\n`;
    }
    if (s) {
      reply += `\n🔊 Stress: ${Math.round(s.acoustic_stress * 100)}%\n`;
      reply += `🐔 Active birds: ${s.active_birds}/${s.bird_count}\n`;
    }
    if (alert) {
      reply += `\n🚨 *ALERT*: ${alert.message}\n`;
    }
    return reply;
  }

  // Fallback
  return (
    `👋 Hello! Welcome to Boonducks Farm.\n\n` +
    `I didn't understand "${message}". Try one of these:\n` +
    `• \`status\` — All coop summary\n` +
    `• \`eggs\` — Production & revenue\n` +
    `• \`alerts\` — Active alerts\n` +
    `• \`coop Cage A\` — Specific coop details\n` +
    `• \`help\` — Full command list`
  );
}

module.exports = { sendDailySummary, sendAlert, handleIncoming, send };