// File: helpers/offenseLogger.js
import fs from 'fs';

const OFFENSE_LOG_FILE = './offense-log.json';

export function logOffense(userId, offense) {
  const log = loadOffenseLog();
  if (!log[userId]) log[userId] = [];
  log[userId].push(offense);
  fs.writeFileSync(OFFENSE_LOG_FILE, JSON.stringify(log, null, 2));
}

export function getRecentOffenses(userId, count = 3) {
  const log = loadOffenseLog();
  return (log[userId] || []).slice(-count);
}

function loadOffenseLog() {
  try {
    return JSON.parse(fs.readFileSync(OFFENSE_LOG_FILE, 'utf8'));
  } catch {
    return {};
  }
}