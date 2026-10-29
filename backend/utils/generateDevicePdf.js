'use strict';
const PDFDocument = require('pdfkit');

const C = {
  brand:   '#1A56DB',
  brand2:  '#1E3A8A',
  accent:  '#0EA5E9',
  dark:    '#0F172A',
  mid:     '#475569',
  light:   '#94A3B8',
  white:   '#FFFFFF',
  green:   '#16A34A',
  greenBg: '#F0FDF4',
  greenBd: '#86EFAC',
  amber:   '#D97706',
  amberBg: '#FFFBEB',
  amberBd: '#FCD34D',
  violet:  '#7C3AED',
  violetBg:'#F5F3FF',
  violetBd:'#C4B5FD',
  red:     '#DC2626',
  redBg:   '#FEF2F2',
  codeBg:  '#0F172A',
  codeGreen:'#4ADE80',
  codeBlue: '#60A5FA',
  codeAmber:'#FCD34D',
  codeWhite:'#F1F5F9',
  codeGray: '#64748B',
  rowAlt:  '#F8FAFC',
};

/* ─── helpers ──────────────────────────────────────────────────────── */
function newPage(doc) { doc.addPage(); }

function coverBanner(doc, text1, text2, subtitle) {
  const w = doc.page.width;
  // gradient-like effect with two rects
  doc.rect(0, 0, w, 200).fill(C.brand2);
  doc.rect(0, 140, w, 60).fill(C.brand);
  doc.fillColor(C.white).fontSize(44).font('Helvetica-Bold')
     .text(text1, 50, 36, { align: 'center' });
  doc.fillColor('#BFDBFE').fontSize(15).font('Helvetica')
     .text(text2, 50, 92, { align: 'center' });
  doc.fillColor('#E0F2FE').fontSize(10).font('Helvetica')
     .text(subtitle, 50, 118, { align: 'center' });
}

function sectionHeader(doc, num, title, color) {
  if (doc.y > doc.page.height - 100) newPage(doc);
  doc.moveDown(0.5);
  const y = doc.y;
  const w = doc.page.width - 100;
  doc.rect(50, y, 6, 28).fill(color || C.brand);
  doc.rect(56, y, w - 6, 28).fill(C.rowAlt).stroke('#E2E8F0');
  if (num) {
    doc.fillColor(color || C.brand).fontSize(8).font('Helvetica-Bold')
       .text(`STEP ${num}`, 66, y + 4, { lineBreak: false });
  }
  doc.fillColor(C.dark).fontSize(12).font('Helvetica-Bold')
     .text(title, num ? 110 : 66, y + 8, { lineBreak: false });
  doc.y = y + 36;
  doc.fillColor(C.dark);
}

function subHeader(doc, text, color) {
  doc.moveDown(0.3)
     .fillColor(color || C.mid).fontSize(9).font('Helvetica-Bold')
     .text(text).moveDown(0.15).fillColor(C.dark);
}

function bodyText(doc, text) {
  doc.fillColor(C.dark).fontSize(9).font('Helvetica')
     .text(text, { lineGap: 3 }).moveDown(0.2);
}

function note(doc, text, type) {
  // type: 'info'|'warn'|'ok'|'tip'
  const map = {
    info: { bg: '#EFF6FF', bd: '#BFDBFE', ic: '  ℹ ', c: C.brand },
    warn: { bg: C.amberBg, bd: C.amberBd, ic: '  ⚠ ', c: C.amber },
    ok:   { bg: C.greenBg, bd: C.greenBd, ic: '  ✓ ', c: C.green },
    tip:  { bg: C.violetBg, bd: C.violetBd, ic: '  ★ ', c: C.violet },
  };
  const m = map[type] || map.info;
  const x = 50, w = doc.page.width - 100;
  const lines = text.split('\n');
  const bh = lines.length * 13 + 14;
  if (doc.y + bh > doc.page.height - 60) newPage(doc);
  const y = doc.y;
  doc.rect(x, y, 4, bh).fill(m.c);
  doc.rect(x + 4, y, w - 4, bh).fill(m.bg).stroke(m.bd);
  doc.fillColor(m.c).fontSize(8.5).font('Helvetica-Bold')
     .text(m.ic + text, x + 10, y + 7, { width: w - 16, lineGap: 4 });
  doc.y = y + bh + 6;
  doc.fillColor(C.dark);
}

function codeBlock(doc, lines, labels) {
  // labels = array of {text, color} for inline annotations (optional)
  const arr = Array.isArray(lines) ? lines : lines.split('\n');
  const lh = 12, pad = 10;
  const bh = arr.length * lh + pad * 2 + (labels ? 16 : 0);
  const x = 50, w = doc.page.width - 100;
  if (doc.y + bh > doc.page.height - 60) newPage(doc);
  const y = doc.y;

  doc.rect(x, y, w, bh).fill(C.codeBg);

  // terminal dots
  doc.circle(x + 12, y + 10, 3).fill('#EF4444');
  doc.circle(x + 22, y + 10, 3).fill('#F59E0B');
  doc.circle(x + 32, y + 10, 3).fill('#22C55E');

  arr.forEach((line, i) => {
    // colour keywords
    let col = C.codeWhite;
    if (line.startsWith('#') || line.startsWith('//')) col = C.codeGray;
    else if (line.includes('→') || line.includes('✓') || line.includes('OK')) col = C.codeGreen;
    else if (line.includes('mqtt') || line.includes('MQTT') || line.includes('enthutech')) col = C.codeBlue;
    else if (line.includes('ERROR') || line.includes('FAIL')) col = '#F87171';
    else if (line.match(/"[^"]*":/)) col = C.codeAmber;

    doc.fillColor(col).fontSize(7.5).font('Courier')
       .text(line, x + pad, y + pad + 16 + i * lh, { lineBreak: false, width: w - pad * 2 });
  });

  doc.fillColor(C.dark).font('Helvetica');
  doc.y = y + bh + 8;
}

function dataBox(doc, direction, topic, payload, dirColor) {
  const lines = JSON.stringify(payload, null, 2).split('\n');
  const lh = 11, pad = 8;
  const hdrH = 24;
  const codeH = lines.length * lh + pad * 2;
  const bh = hdrH + codeH;
  const x = 50, w = doc.page.width - 100;
  if (doc.y + bh > doc.page.height - 60) newPage(doc);
  const y = doc.y;

  // header
  doc.rect(x, y, w, hdrH).fill(dirColor);
  doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
     .text(direction, x + 8, y + 4, { lineBreak: false });
  doc.fillColor('#E0F2FE').fontSize(7.5).font('Courier')
     .text(topic, x + 8, y + 14, { lineBreak: false });

  // code
  const cy = y + hdrH;
  doc.rect(x, cy, w, codeH).fill(C.codeBg);
  lines.forEach((l, i) => {
    let col = C.codeWhite;
    if (l.match(/"[^"]+"\s*:/)) col = C.codeAmber;
    else if (l.match(/:\s*"[^"]*"/)) col = C.codeGreen;
    else if (l.match(/:\s*[\d.]+/)) col = C.codeBlue;
    doc.fillColor(col).fontSize(7).font('Courier')
       .text(l, x + pad, cy + pad + i * lh, { lineBreak: false, width: w - pad * 2 });
  });

  doc.fillColor(C.dark).font('Helvetica');
  doc.y = y + bh + 10;
}

function kvTable(doc, rows, widths) {
  const x = 50, w = doc.page.width - 100;
  const cws = widths || [0.3, 0.35, 0.35].map(f => f * w);
  const rh = 18;
  let y = doc.y;

  // header
  doc.rect(x, y, w, rh).fill(C.brand);
  const headers = rows[0];
  headers.forEach((h, i) => {
    const cx = x + cws.slice(0, i).reduce((a, b) => a + b, 0);
    doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold')
       .text(h, cx + 6, y + 5, { width: cws[i] - 8, lineBreak: false });
  });
  y += rh;

  rows.slice(1).forEach((row, ri) => {
    if (y + rh > doc.page.height - 60) { newPage(doc); y = 50; }
    doc.rect(x, y, w, rh).fill(ri % 2 === 0 ? C.rowAlt : C.white).stroke('#E2E8F0');
    row.forEach((cell, ci) => {
      const cx = x + cws.slice(0, ci).reduce((a, b) => a + b, 0);
      const isMono = ci > 0 && (String(cell).includes('/') || String(cell).includes(':') || String(cell).includes('AT+'));
      doc.fillColor(C.dark).fontSize(8)
         .font(isMono ? 'Courier' : 'Helvetica')
         .text(String(cell), cx + 6, y + 5, { width: cws[ci] - 8, lineBreak: false });
    });
    y += rh;
  });
  doc.y = y + 8;
  doc.fillColor(C.dark);
}

function footer(doc, pg) {
  const pw = doc.page.width, ph = doc.page.height;
  doc.rect(0, ph - 30, pw, 30).fill('#F1F5F9');
  doc.rect(0, ph - 30, pw, 1).fill('#E2E8F0');
  doc.fillColor(C.light).fontSize(7).font('Helvetica')
     .text('HS01 Home Security System  —  Device Registration Guide  |  tasecurities.godem.in',
           50, ph - 20, { width: pw - 130 });
  doc.fillColor(C.brand).fontSize(8).font('Helvetica-Bold')
     .text(`${pg}`, pw - 60, ph - 20, { width: 40, align: 'right' });
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PDF GENERATOR
═══════════════════════════════════════════════════════════════════ */
function generateDevicePdf(res) {
  const doc = new PDFDocument({
    size: 'A4', margins: { top: 50, bottom: 55, left: 50, right: 50 },
    autoFirstPage: false,
    info: {
      Title:    'HS01 Device Registration Guide',
      Author:   'TA Securities System',
      Subject:  'Complete A-to-Z device registration documentation',
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="HS01_Device_Registration_Guide.pdf"');
  doc.pipe(res);

  let pg = 0;
  doc.on('pageAdded', () => pg++);

  /* ════════════════════════════════════════════
     PAGE 1 — COVER
  ════════════════════════════════════════════ */
  newPage(doc);
  coverBanner(doc, 'HS01', 'Home Security Device', 'Complete Device Registration Guide — A to Z');

  // step index card
  doc.rect(60, 210, doc.page.width - 120, 330).fill(C.white).stroke('#E2E8F0');

  // left bar
  doc.rect(60, 210, 5, 330).fill(C.brand);

  doc.fillColor(C.brand).fontSize(10).font('Helvetica-Bold')
     .text('Registration Process Overview', 75, 222);
  doc.fillColor(C.mid).fontSize(8).font('Helvetica')
     .text('Follow all 9 steps in sequence to fully register a device', 75, 236);

  const steps = [
    ['STEP 1', 'Plug Device via USB Cable',                         C.amber],
    ['STEP 2', 'Select COM Port in Serial Monitor',                  C.amber],
    ['STEP 3', 'Read Device Values from Serial Monitor Output',      C.brand],
    ['STEP 4', 'Device Auto-Connects to MQTT Broker',               C.brand],
    ['STEP 5', 'MQTT Acknowledgment — Server Receives Device Data', C.green],
    ['STEP 6', 'Check Device Online Status on Dashboard',           C.green],
    ['STEP 7', 'Add Device to Database (Admin Panel)',              C.violet],
    ['STEP 8', 'QA Verify the Device',                              C.violet],
    ['STEP 9', 'Customer Registration via QR Code',                 '#0891B2'],
  ];

  steps.forEach(([num, title, color], i) => {
    const sy = 260 + i * 30;
    doc.rect(75, sy, 8, 8).fill(color);
    doc.fillColor(color).fontSize(7.5).font('Helvetica-Bold')
       .text(num, 90, sy + 0.5, { lineBreak: false });
    doc.fillColor(C.dark).fontSize(9).font('Helvetica')
       .text(title, 138, sy + 0.5, { lineBreak: false });
  });

  // info box
  doc.rect(60, 560, doc.page.width - 120, 80).fill(C.greenBg).stroke(C.greenBd);
  doc.fillColor(C.green).fontSize(9).font('Helvetica-Bold').text('Server & MQTT Credentials', 76, 572);
  [
    ['Dashboard',     'https://tasecurities.godem.in'],
    ['MQTT Broker',   'tasecurities.godem.in'],
    ['MQTT Port',     '1883'],
    ['MQTT Username', '(none — open broker)'],
    ['MQTT Client ID','<DEVICE_ID>  e.g.  TA001'],
  ].forEach(([k, v], i) => {
    doc.fillColor(C.mid).fontSize(8).font('Helvetica-Bold')
       .text(`${k}:`, 76, 588 + i * 12, { lineBreak: false, width: 90 });
    doc.fillColor(C.dark).font('Courier')
       .text(v, 170, 588 + i * 12, { lineBreak: false });
  });

  doc.fillColor(C.light).fontSize(7.5).font('Helvetica')
     .text(`Generated: ${new Date().toLocaleString()}`, 50, doc.page.height - 48, { align: 'center', width: doc.page.width - 100 });
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 2 — STEP 1 & 2: USB + COM PORT
  ════════════════════════════════════════════ */
  newPage(doc);

  sectionHeader(doc, '1', 'Plug the Device via USB Cable', C.amber);
  bodyText(doc, 'Connect the ESP32 development board to your PC using a Micro-USB or USB-C cable. Make sure to use a data cable (not a charging-only cable).');
  note(doc, 'Windows: A new COM port appears in Device Manager → Ports (COM & LPT)\nLinux/Mac: Device appears as /dev/ttyUSB0 or /dev/cu.usbserial-XXXXX', 'info');

  subHeader(doc, 'Required USB Driver');
  kvTable(doc, [
    ['Chip', 'Driver', 'Download'],
    ['CP2102 (most ESP32)', 'CP210x USB to UART',  'silabs.com/developers/usb-to-uart-bridge-vcp-drivers'],
    ['CH340 (some clones)', 'CH340 Driver',         'wch-ic.com/downloads/category/30.html'],
    ['FTDI',                'FTDI VCP Driver',      'ftdichip.com/drivers/vcp-drivers'],
  ], [(doc.page.width - 100) * 0.20, (doc.page.width - 100) * 0.30, (doc.page.width - 100) * 0.50]);

  note(doc, 'After installing the driver, unplug and re-plug the USB cable.', 'tip');

  sectionHeader(doc, '2', 'Select COM Port — Open Serial Monitor', C.amber);
  bodyText(doc, 'Open your Serial Monitor tool and connect to the device at 115200 baud. Use any of the options below:');

  subHeader(doc, 'Option A — Arduino IDE');
  codeBlock(doc, [
    '  1. Open Arduino IDE',
    '  2. Tools → Port → Select COMx (Windows) or /dev/ttyUSB0 (Linux)',
    '  3. Tools → Serial Monitor  (or press Ctrl+Shift+M)',
    '  4. Set baud rate to: 115200',
    '  5. Press the ESP32 RESET button',
    '  → Device boot log appears',
  ]);

  subHeader(doc, 'Option B — VS Code (ESP-IDF Extension)');
  codeBlock(doc, [
    '  1. Open VS Code with Espressif IDF extension installed',
    '  2. Bottom status bar → click port icon → select COMx',
    '  3. Press F1 → "ESP-IDF: Monitor Device"  (or idf.py monitor)',
    '  4. Press RESET button on board',
    '  → Serial output streams in the terminal',
  ]);

  subHeader(doc, 'Option C — PuTTY / Screen (any OS)');
  codeBlock(doc, [
    '  Windows — PuTTY:',
    '    Connection type: Serial',
    '    Serial line: COM3  (replace with your port)',
    '    Speed: 115200',
    '    Click Open',
    '',
    '  Linux / Mac — screen:',
    '    screen /dev/ttyUSB0 115200',
  ]);

  note(doc, 'Baud rate MUST be 115200. Wrong baud rate shows garbage characters.', 'warn');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 3 — STEP 3: SERIAL MONITOR VALUES
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '3', 'Read Device Values from Serial Monitor Output', C.brand);
  bodyText(doc, 'Press the RESET/EN button on the ESP32. The device will boot and print all its identification values. Record these — you will need them when adding the device to the database.');

  subHeader(doc, 'Expected Serial Monitor Output on Boot');
  codeBlock(doc, [
    '  ═══════════════════════════════════════════',
    '   HS01 Home Security Device',
    '   Booting... Firmware v1.0.0',
    '  ═══════════════════════════════════════════',
    '  [SYS ] Device ID       : TA001',
    '  [SYS ] Serial Number   : HS01-2024-0001',
    '  [SYS ] IMEI            : 867123045678901',
    '  [SYS ] MAC Address     : AA:BB:CC:DD:EE:FF',
    '  [SYS ] Model           : HS01',
    '  [SYS ] Firmware Version: 1.0.0',
    '  [WIFI] Connecting to WiFi ......... OK ✓',
    '  [WIFI] IP Address      : 192.168.1.105',
    '  [MQTT] Broker          : tasecurities.godem.in:1883',
    '  [MQTT] Client ID       : TA001',
    '  [MQTT] Connecting ................. OK ✓',
    '  [MQTT] Subscribed to   : enthutech/TA001/cmd',
    '  [MQTT] Subscribed to   : enthutech/TA001/ota',
    '  [MQTT] Published status → enthutech/TA001/status',
    '  [SYS ] Device ready.',
  ]);

  subHeader(doc, 'Values to Copy from Serial Monitor');
  kvTable(doc, [
    ['Field',            'Example Value',         'Where to Use'],
    ['Device ID',        'TA001',                 'Add Device form — Device ID field'],
    ['IMEI',             '867123045678901',        'Add Device form — IMEI field (15 digits)'],
    ['MAC Address',      'AA:BB:CC:DD:EE:FF',     'Add Device form — MAC Address field'],
    ['Model',            'HS01',                  'Add Device form — Model field'],
    ['Firmware Version', '1.0.0',                 'Add Device form — Firmware Version'],
    ['Serial Number',    'HS01-2024-0001',        'Add Device form — Serial Number'],
  ], [(doc.page.width - 100) * 0.28, (doc.page.width - 100) * 0.32, (doc.page.width - 100) * 0.40]);

  note(doc, 'Device ID is unique per device. It is used as the MQTT Client ID and as the primary key in the database.', 'ok');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 4 — STEP 4: MQTT CONNECTION
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '4', 'Device Auto-Connects to MQTT Broker', C.brand);
  bodyText(doc, 'Immediately after WiFi connects, the device automatically establishes an MQTT connection to the server. No manual action needed — this happens in firmware.');

  subHeader(doc, 'MQTT Connection Details (used by the device firmware)');
  kvTable(doc, [
    ['Parameter',     'Value',                         'Notes'],
    ['Broker Host',   'tasecurities.godem.in',         'Server public IP / domain'],
    ['Port',          '1883',                          'Standard MQTT TCP port'],
    ['Client ID',     'TA001  (= DEVICE_ID)',          'Unique per device — from Serial Monitor'],
    ['Username',      '(none)',                        'Open broker, no auth required'],
    ['Password',      '(none)',                        'Open broker, no auth required'],
    ['Keep Alive',    '30 seconds',                    'Ping interval to keep connection alive'],
    ['Clean Session', 'true',                          'Fresh session on each reconnect'],
    ['QoS (publish)', '0 for data, 1 for status/OTA', 'QoS 1 = guaranteed delivery'],
  ], [(doc.page.width - 100) * 0.25, (doc.page.width - 100) * 0.35, (doc.page.width - 100) * 0.40]);

  subHeader(doc, 'MQTT Subscribe — Topics Device Listens To');
  kvTable(doc, [
    ['Topic',                     'QoS', 'Purpose'],
    ['enthutech/TA001/cmd',       '1',   'Receive commands from server (PROTECT_ON, PROTECT_OFF, CONFIGURE)'],
    ['enthutech/TA001/ota',       '1',   'Receive OTA firmware update trigger from server'],
  ], [(doc.page.width - 100) * 0.52, (doc.page.width - 100) * 0.08, (doc.page.width - 100) * 0.40]);

  subHeader(doc, 'On Connection — Device Publishes Status Payload');
  bodyText(doc, 'Immediately after MQTT connects, device publishes to:  enthutech/TA001/status');
  dataBox(doc,
    '📤  DEVICE → SERVER  (on every boot / reconnect)',
    'enthutech/TA001/status',
    {
      "Device-ID":        "TA001",
      "status":           "online",
      "firmware_version": "1.0.0",
      "imei":             "867123045678901",
      "mac":              "AA:BB:CC:DD:EE:FF",
      "model":            "HS01",
      "mqtt_broker":      "tasecurities.godem.in",
      "mqtt_port":        1883,
      "mqtt_client_id":   "TA001"
    },
    C.brand
  );

  note(doc, 'The server saves this data automatically. Admin can see the device is online on the dashboard before even adding it to the DB.', 'info');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 5 — STEP 5: MQTT ACK + CHECK
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '5', 'MQTT Acknowledgment — Server Receives Device Data', C.green);
  bodyText(doc, 'The MQTT broker (aedes) running on the server receives the device status message and processes it. The server logs the event and stores it in the PostgreSQL database automatically.');

  subHeader(doc, 'What the server does when it receives the /status message');
  codeBlock(doc, [
    '  [MQTT] Published message on enthutech/TA001/status',
    '  [MQTT] Device TA001 → status: online',
    '  [MQTT] Firmware version: 1.0.0 saved to DB',
    '  [MQTT] Last seen: updated ✓',
    '  [MQTT] Telemetry log: saved ✓',
  ]);

  subHeader(doc, 'Server → Device Acknowledgment (cmd topic)');
  bodyText(doc, 'Server sends acknowledgment back to device confirming connection and providing full MQTT topic configuration:');
  dataBox(doc,
    '📥  SERVER → DEVICE  (acknowledgment after status received)',
    'enthutech/TA001/cmd',
    {
      "cmd":           "CONFIGURE",
      "status":        "acknowledged",
      "mqtt_broker":   "tasecurities.godem.in",
      "mqtt_port":     1883,
      "mqtt_client_id":"TA001",
      "topics": {
        "data":   "enthutech/TA001/data",
        "status": "enthutech/TA001/status",
        "cmd":    "enthutech/TA001/cmd",
        "ota":    "enthutech/TA001/ota"
      },
      "ota_base_url":  "https://tasecurities.godem.in/api/public/ota/download",
      "server_url":    "https://tasecurities.godem.in"
    },
    C.green
  );

  subHeader(doc, 'Serial Monitor — Device Receives Acknowledgment');
  codeBlock(doc, [
    '  [MQTT] Message received on: enthutech/TA001/cmd',
    '  [MQTT] Command: CONFIGURE',
    '  [MQTT] Server acknowledged connection ✓',
    '  [MQTT] MQTT config saved to NVS storage',
    '  [MQTT] OTA base URL: https://tasecurities.godem.in/api/public/ota/download',
    '  [SYS ] Device fully configured. Sending sensor data every 30s.',
  ]);

  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 6 — STEP 6: CHECK DEVICE ONLINE
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '6', 'Check Device Online Status on Dashboard', C.green);
  bodyText(doc, 'Before adding the device to the database, verify that it is communicating correctly by checking the live MQTT status on the admin dashboard.');

  subHeader(doc, 'Verify via Admin Dashboard');
  codeBlock(doc, [
    '  1. Open:  https://tasecurities.godem.in',
    '  2. Login with admin credentials',
    '  3. Go to:  Dashboard  (home page)',
    '  4. Look for the device in the live status panel',
    '  5. If device is connected, you will see:',
    '     • Green dot: Online',
    '     • Last seen: just now',
    '     • Firmware: 1.0.0',
    '  6. ✓  Device is communicating correctly',
  ]);

  subHeader(doc, 'Verify via MQTT Explorer (optional — PC tool)');
  codeBlock(doc, [
    '  Download: https://mqtt-explorer.com/',
    '',
    '  Connection settings:',
    '    Host:     tasecurities.godem.in',
    '    Port:     1883',
    '    Protocol: mqtt://',
    '',
    '  Subscribe to:  enthutech/TA001/#',
    '',
    '  You should see messages arriving on:',
    '    enthutech/TA001/status   → {"status":"online","Device-ID":"TA001",...}',
    '    enthutech/TA001/data     → {"battery":3.91,"pir":0,...}  (every 30s)',
  ]);

  subHeader(doc, 'Verify via MQTT command line (mosquitto_sub)');
  codeBlock(doc, [
    '  # Install mosquitto clients',
    '  sudo apt install mosquitto-clients',
    '',
    '  # Subscribe to all device topics',
    '  mosquitto_sub -h tasecurities.godem.in -p 1883 -t "enthutech/TA001/#" -v',
    '',
    '  # Expected output:',
    '  # enthutech/TA001/status  {"Device-ID":"TA001","status":"online",...}',
    '  # enthutech/TA001/data    {"Device-ID":"TA001","battery":3.91,"pir":0}',
  ]);

  note(doc, 'If no messages appear within 30 seconds, check WiFi credentials in firmware, broker address, and that port 1883 is open on the server firewall.', 'warn');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 7 — STEP 7: ADD TO DATABASE
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '7', 'Add Device to Database — Admin Panel', C.violet);
  bodyText(doc, 'Now add the device officially to the system database using the values you noted from Serial Monitor in Step 3.');

  subHeader(doc, 'Navigation');
  codeBlock(doc, [
    '  1. Open:   https://tasecurities.godem.in',
    '  2. Login with admin credentials',
    '  3. Go to:  Devices  (left sidebar)',
    '  4. Click:  "+ Add Device"  button (top right)',
  ]);

  subHeader(doc, 'Add Device Form — Field Reference');
  kvTable(doc, [
    ['Form Field',       'Value to Enter',              'Source'],
    ['Device ID',        'TA001',                       'Serial Monitor  [SYS ] Device ID'],
    ['IMEI',             '867123045678901',              'Serial Monitor  [SYS ] IMEI (15 digits)'],
    ['MAC Address',      'AA:BB:CC:DD:EE:FF',           'Serial Monitor  [SYS ] MAC Address'],
    ['Model',            'HS01',                        'Serial Monitor  [SYS ] Model'],
    ['Firmware Version', '1.0.0',                       'Serial Monitor  [SYS ] Firmware Version'],
    ['Serial Number',    'HS01-2024-0001',              'Serial Monitor  [SYS ] Serial Number'],
  ], [(doc.page.width - 100) * 0.27, (doc.page.width - 100) * 0.33, (doc.page.width - 100) * 0.40]);

  subHeader(doc, 'API Call Made by the Form (POST /api/devices)');
  dataBox(doc,
    '📤  ADMIN BROWSER → SERVER  (register device API)',
    'POST  https://tasecurities.godem.in/api/devices',
    {
      "device_id":        "TA001",
      "imei":             "867123045678901",
      "mac_address":      "AA:BB:CC:DD:EE:FF",
      "model":            "HS01",
      "firmware_version": "1.0.0",
      "serial_number":    "HS01-2024-0001"
    },
    C.violet
  );

  subHeader(doc, 'Server Response — Success');
  codeBlock(doc, [
    '  HTTP 200 OK',
    '  {',
    '    "success": true,',
    '    "device": {',
    '      "device_id":        "TA001",',
    '      "status":           "Available",',
    '      "imei":             "867123045678901",',
    '      "mac_address":      "AA:BB:CC:DD:EE:FF",',
    '      "model":            "HS01",',
    '      "firmware_version": "1.0.0",',
    '      "created_at":       "2024-08-11T12:00:00Z"',
    '    }',
    '  }',
    '',
    '  → Device status is now: "Available"',
    '  → Device appears in the Devices list',
  ]);

  note(doc, 'After clicking Register, a green toast appears: "Device TA001 registered — verify now". Click "verify now" to go directly to Step 8.', 'ok');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 8 — STEP 8: QA VERIFY
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '8', 'QA Verify the Device', C.violet);
  bodyText(doc, 'Verification is the QA approval step. It records who deployed and tested the device, generates a QR code label, and marks the device as ready for customer assignment.');

  subHeader(doc, 'Navigation');
  codeBlock(doc, [
    '  Option A: Click "verify now" link in the green success toast (Step 7)',
    '  Option B: Devices page → find device → click the blue shield icon',
    '  Option C: Left sidebar → Verify Device → select device from list',
  ]);

  subHeader(doc, 'Verify Device Form — Field Reference');
  kvTable(doc, [
    ['Form Field',           'What to Enter'],
    ['Device ID',            'Auto-filled from the selected device (e.g. TA001)'],
    ['Deployment Engineer',  'Full name of the engineer who installed the device'],
    ['Quality Inspector',    'Full name of the QA person who tested it'],
    ['Manufactured Date',    'Date the device was manufactured (from label)'],
    ['Verification Date',    'Today\'s date — the date of QA sign-off'],
    ['QA Notes',             'Any observations, test results, or special notes'],
  ], [(doc.page.width - 100) * 0.38, (doc.page.width - 100) * 0.62]);

  subHeader(doc, 'API Call Made by the Form (POST /api/devices/verify)');
  dataBox(doc,
    '📤  ADMIN BROWSER → SERVER  (verify device API)',
    'POST  https://tasecurities.godem.in/api/devices/verify',
    {
      "device_id":           "TA001",
      "deploymentEngineer":  "Ravi Kumar",
      "testerName":          "Priya Singh",
      "manufactured_date":   "2024-07-01",
      "verification_date":   "2024-08-11",
      "qa_notes":            "All sensors tested OK. PIR range 5m. Battery 100%."
    },
    C.violet
  );

  subHeader(doc, 'After Verification');
  codeBlock(doc, [
    '  → Device status changes from "Available" → "Verified"',
    '  → QR code generated containing:  TA001',
    '  → QR code available to download (PDF label)',
    '  → Device ready for customer self-registration',
    '  → Deployment Engineer + QA Inspector names saved in DB',
  ]);

  note(doc, 'Download and print the QR label. Attach it to the device box. The customer will scan this QR to register ownership.', 'tip');
  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 9 — STEP 9: CUSTOMER REGISTRATION
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, '9', 'Customer Registration via QR Code', '#0891B2');
  bodyText(doc, 'The customer scans the QR code label on the device box using their phone. This opens the registration page on the server where they enter their details and verify via OTP.');

  subHeader(doc, 'Customer Registration Flow');
  codeBlock(doc, [
    '  Customer scans QR code on device box',
    '       ↓',
    '  Browser opens: https://tasecurities.godem.in/register?id=TA001',
    '       ↓',
    '  Page shows: "Device TA001 — HS01 Home Security"',
    '  Customer fills:',
    '    • Full Name',
    '    • Address / Location',
    '    • Mobile Number',
    '       ↓',
    '  Customer clicks "Send OTP"',
    '       ↓',
    '  Server sends OTP SMS to the mobile number',
    '       ↓',
    '  Customer enters 6-digit OTP',
    '       ↓',
    '  Server verifies OTP → assigns device to customer',
    '       ↓',
    '  Device status changes: "Verified" → "Registered"',
    '       ↓',
    '  Customer can now access their dashboard',
    '  Dashboard shows: live sensor data, alerts, arm/disarm control',
  ]);

  subHeader(doc, 'API Calls During Customer Registration');
  kvTable(doc, [
    ['Step', 'API Call', 'Purpose'],
    ['Check device',  'GET /api/public/device/TA001',            'Verify device exists and is Verified'],
    ['Send OTP',      'POST /api/public/registration/send-otp',  'Send SMS OTP to customer phone'],
    ['Verify OTP',    'POST /api/public/registration/verify',    'Verify OTP + create customer record'],
  ], [(doc.page.width - 100) * 0.15, (doc.page.width - 100) * 0.48, (doc.page.width - 100) * 0.37]);

  subHeader(doc, 'Final Device Status After All Steps');
  kvTable(doc, [
    ['Status',       'Reached After',                'Features Unlocked'],
    ['Available',    'Step 7: Add to DB',            'Visible in admin device list'],
    ['Verified',     'Step 8: QA Verification',      'QR label generated, ready for customer'],
    ['Registered',   'Step 9: Customer OTP',         'Live dashboard, alerts, remote control'],
  ], [(doc.page.width - 100) * 0.22, (doc.page.width - 100) * 0.35, (doc.page.width - 100) * 0.43]);

  note(doc, 'All 9 steps are now complete. The device is live and the customer can use the app/dashboard.', 'ok');

  footer(doc, pg);

  /* ════════════════════════════════════════════
     PAGE 10 — QUICK REFERENCE
  ════════════════════════════════════════════ */
  newPage(doc);
  sectionHeader(doc, null, 'QUICK REFERENCE CARD', C.brand2);
  bodyText(doc, 'Keep this page as a reference during device setup.');

  subHeader(doc, 'All MQTT Topics');
  kvTable(doc, [
    ['Topic',                      'Direction',         'QoS', 'Content'],
    ['enthutech/<ID>/data',        'Device → Server',   '0',   'Sensor readings, battery, motion (every 30s)'],
    ['enthutech/<ID>/status',      'Device → Server',   '1',   'Online status, firmware version (on boot)'],
    ['enthutech/<ID>/cmd',         'Server → Device',   '1',   'Commands: PROTECT_ON, PROTECT_OFF, CONFIGURE'],
    ['enthutech/<ID>/ota',         'Server → Device',   '1',   'OTA trigger: {"version","url","md5"}'],
    ['enthutech/<ID>/ota',         'Device → Server',   '1',   'OTA progress: {"ota_status","progress"}'],
  ], [(doc.page.width-100)*0.34, (doc.page.width-100)*0.18, (doc.page.width-100)*0.07, (doc.page.width-100)*0.41]);

  subHeader(doc, 'Server Credentials & URLs');
  kvTable(doc, [
    ['Resource',           'Value'],
    ['Admin Dashboard',    'https://tasecurities.godem.in'],
    ['MQTT Broker',        'tasecurities.godem.in  :  1883'],
    ['MQTT Client ID',     '<DEVICE_ID>  (e.g. TA001)'],
    ['MQTT Username',      '(none)'],
    ['MQTT Password',      '(none)'],
    ['OTA Download',       'https://tasecurities.godem.in/api/public/ota/download/<id>'],
    ['Device Source Code', 'https://tasecurities.godem.in/api/public/ota/device-code'],
    ['This PDF',           'https://tasecurities.godem.in/api/public/device-docs'],
  ], [(doc.page.width-100)*0.30, (doc.page.width-100)*0.70]);

  subHeader(doc, 'Troubleshooting Quick Fixes');
  kvTable(doc, [
    ['Problem',                         'Fix'],
    ['Garbage in Serial Monitor',       'Wrong baud rate — set to 115200'],
    ['No COM port appears',             'Install CP2102 or CH340 USB driver'],
    ['MQTT not connecting',             'Check broker: tasecurities.godem.in:1883, check WiFi'],
    ['Device not in dashboard',         'Check Device-ID in firmware matches DB entry'],
    ['OTA not triggering',              'Device must be online (MQTT connected) when admin pushes'],
    ['Customer cannot register',        'Device must be in "Verified" status first'],
    ['OTP SMS not received',            'Check phone number format, check SMS gateway balance'],
  ], [(doc.page.width-100)*0.38, (doc.page.width-100)*0.62]);

  subHeader(doc, 'Step Checklist');
  const checks = [
    'STEP 1  — USB cable plugged, driver installed, COM port visible',
    'STEP 2  — Serial Monitor open at 115200 baud',
    'STEP 3  — Device ID, IMEI, MAC, Firmware noted from serial output',
    'STEP 4  — Serial shows: [MQTT] Connecting ... OK ✓',
    'STEP 5  — Serial shows: [MQTT] Server acknowledged connection ✓',
    'STEP 6  — Device appears online in admin dashboard',
    'STEP 7  — Device added to DB, status = Available',
    'STEP 8  — QA verified, QR label downloaded and printed',
    'STEP 9  — Customer scanned QR, entered OTP, status = Registered',
  ];
  const cx = 50, cw = doc.page.width - 100;
  const rh2 = 16;
  let cy2 = doc.y;
  checks.forEach((c, i) => {
    if (cy2 + rh2 > doc.page.height - 50) { newPage(doc); cy2 = 50; }
    doc.rect(cx, cy2, cw, rh2).fill(i % 2 === 0 ? '#F0FDF4' : C.white).stroke('#BBF7D0');
    doc.rect(cx, cy2, cw, rh2).stroke('#BBF7D0');
    // checkbox
    doc.rect(cx + 6, cy2 + 4, 8, 8).fill(C.white).stroke(C.green);
    doc.fillColor(C.dark).fontSize(8).font('Helvetica')
       .text(c, cx + 22, cy2 + 4, { lineBreak: false });
    cy2 += rh2;
  });
  doc.y = cy2 + 8;

  footer(doc, pg);

  doc.end();
}

module.exports = { generateDevicePdf };
