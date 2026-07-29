/**
 * Boonducks Farm WhatsApp/SMS Webhook
 *
 * Receives incoming Twilio messages and routes them to the bot service.
 * Twilio expects POST with Content-Type application/x-www-form-urlencoded
 * or multipart/form-data.
 *
 * POST /api/webhook/whatsapp  — incoming WhatsApp message (Twilio webhook)
 */

const express = require('express');
const router = express.Router();
const whatsapp = require('../services/whatsapp');

// Twilio expects URL-encoded form data, so we need the body-parser for that
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

// Incoming message webhook (Twilio calls this when farmer replies)
router.post('/', async (req, res) => {
  const { Body, From } = req.body;

  if (!Body) {
    return res.status(400).send('Missing message body');
  }

  console.log(`[WhatsApp Webhook] From: ${From} — "${Body.substring(0, 100)}"`);

  try {
    const reply = await whatsapp.handleIncoming(Body, From);
    // Twilio expects TwiML XML response for synchronous replies
    res.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response><Message><Body>${escapeXml(reply)}</Body></Message></Response>`
    );
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err.message);
    res.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<Response><Message><Body>Sorry, I couldn't process that. Try "help" for commands.</Body></Message></Response>`
    );
  }
});

// Health check for webhook (Twilio sends GET to verify endpoint)
router.get('/', (req, res) => {
  res.status(200).send('Boonducks WhatsApp Bot webhook is live.');
});

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;