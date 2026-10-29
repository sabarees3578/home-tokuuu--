const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'command-templates.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, '[]', 'utf8');
}

function readTemplates() {
  try {
    ensureStore();
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[commandStore] read failed:', err.message);
    return [];
  }
}

function writeTemplates(list) {
  ensureStore();
  fs.writeFileSync(STORE_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function createTemplate({ code, label, desc, param, placeholder }) {
  const list = readTemplates();
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error('Command code is required');
  if (list.some(t => t.code === normalized)) {
    throw new Error(`Command ${normalized} already exists`);
  }
  const now = new Date().toISOString();
  const template = {
    id: crypto.randomUUID(),
    code: normalized,
    label: String(label || '').trim() || normalized,
    desc: String(desc || '').trim(),
    param: !!param,
    placeholder: String(placeholder || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
  list.push(template);
  writeTemplates(list);
  return template;
}

function updateTemplate(id, patch) {
  const list = readTemplates();
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) throw new Error('Command not found');

  const current = list[idx];
  const nextCode = patch.code !== undefined ? normalizeCode(patch.code) : current.code;
  if (!nextCode) throw new Error('Command code is required');
  if (list.some((t, i) => i !== idx && t.code === nextCode)) {
    throw new Error(`Command ${nextCode} already exists`);
  }

  list[idx] = {
    ...current,
    code: nextCode,
    label: patch.label !== undefined ? (String(patch.label).trim() || nextCode) : current.label,
    desc: patch.desc !== undefined ? String(patch.desc).trim() : current.desc,
    param: patch.param !== undefined ? !!patch.param : current.param,
    placeholder: patch.placeholder !== undefined ? String(patch.placeholder).trim() : current.placeholder,
    updatedAt: new Date().toISOString(),
  };
  writeTemplates(list);
  return list[idx];
}

function deleteTemplate(id) {
  const list = readTemplates();
  const next = list.filter(t => t.id !== id);
  if (next.length === list.length) throw new Error('Command not found');
  writeTemplates(next);
  return true;
}

function getCustomCodes() {
  return new Set(readTemplates().map(t => t.code));
}

module.exports = {
  readTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getCustomCodes,
};
