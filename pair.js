const express = require('express');
const fs = require('fs');
const pino = require("pino");
const {
  default: Gifted_Tech,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
} = require("maher-zubair-baileys"); // Baileys fork

const router = express.Router();

function removeFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  fs.rmSync(filePath, { recursive: true, force: true });
};

function generateAimsCode() {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AIMS-CODE-${timestamp}-${random}`;
}

router.get('/', async (req, res) => {
  const id = generateAimsCode();
  let num = req.query.number;

  if (!num || num.length < 10) {
    return res.status(400).json({ error: "Invalid WhatsApp number." });
  }

  async function AIMS_CODE_GENERATOR() {
    const { state, saveCreds } = await useMultiFileAuthState(`./temp/${id}`);
    try {
      let client = Gifted_Tech({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        printQRInTerminal: false, // We use pairing code, not QR
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: ["AIMS-BOT", "Chrome", "1.0"]
      });

      client.ev.on('creds.update', saveCreds);

      client.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
          await delay(5000);
          const data = fs.readFileSync(`./temp/${id}/creds.json`);
          const b64data = Buffer.from(data).toString('base64');
          const session = await client.sendMessage(client.user.id, { text: b64data });

          const msg = `
┏━━━━━━━━━━━━━━
┃ SESSION LINKED: AIMS-CODE
┃ ID: ${id}
┗━━━━━━━━━━━━━━━
Conway Tech || 2025
          `;
          await client.sendMessage(client.user.id, { text: msg }, { quoted: session });

          await delay(100);
          await client.ws.close();
          return removeFile(`./temp/${id}`);
        }

        // Reconnect logic if not logged out
        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
          await delay(10000);
          AIMS_CODE_GENERATOR();
        }
      });

      // 🟩 Trigger pairing code (only if account not registered)
      if (!client.authState.creds.registered) {
        await delay(1000);
        num = num.replace(/[^0-9]/g, '');
        const code = await client.requestPairingCode(num);
        if (!res.headersSent) {
          return res.json({ code, session_id: id });
        }
      }

    } catch (err) {
      console.error("❌ Error occurred:", err);
      removeFile(`./temp/${id}`);
      if (!res.headersSent) {
        res.status(500).json({ code: "Service Unavailable" });
      }
    }
  }

  return AIMS_CODE_GENERATOR();
});

module.exports = router;
