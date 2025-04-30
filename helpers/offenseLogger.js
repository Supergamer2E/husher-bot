import fs from 'fs';
const OFFENSE_LOG_PATH = './offense-log.json';

export function loadOffenseLog() {
  if (!fs.existsSync(OFFENSE_LOG_PATH)) {
    fs.writeFileSync(OFFENSE_LOG_PATH, '{}', 'utf-8');
  }
  return JSON.parse(fs.readFileSync(OFFENSE_LOG_PATH, 'utf-8'));
}

export function saveOffenseLog(log) {
  fs.writeFileSync(OFFENSE_LOG_PATH, JSON.stringify(log, null, 2));
}

export function addOffenseToLog(userId, reason = null, correctorId = null) {
  const log = loadOffenseLog();
  if (!log[userId]) log[userId] = [];

  log[userId].unshift({
    timestamp: Date.now(),
    corrector: correctorId,
    reason: reason || 'N/A'
  });  

  if (log[userId].length > 10) log[userId] = log[userId].slice(0, 10); // keep latest 10
  saveOffenseLog(log);
}

export function getRecentOffenses(userId, limit = 3) {
  const log = loadOffenseLog();
  return (log[userId] || []).slice(0, limit);
}
