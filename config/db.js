const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2), 'utf8');
  }

  if (!fs.existsSync(CLIENTS_FILE)) {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readJSON(filePath) {
  try {
    ensureDataFiles();
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(`Failed to read ${filePath}: ${err.message}`);
  }
}

function writeJSON(filePath, data) {
  try {
    ensureDataFiles();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    throw new Error(`Failed to write ${filePath}: ${err.message}`);
  }
}

function readLeads() {
  return readJSON(LEADS_FILE);
}

function writeLeads(data) {
  return writeJSON(LEADS_FILE, data);
}

function readClients() {
  return readJSON(CLIENTS_FILE);
}

function writeClients(data) {
  return writeJSON(CLIENTS_FILE, data);
}

ensureDataFiles();

module.exports = {
  readLeads,
  writeLeads,
  readClients,
  writeClients,
  LEADS_FILE,
  CLIENTS_FILE,
};
