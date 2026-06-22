const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./quiz.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    audio_path TEXT,
    FOREIGN KEY (set_id) REFERENCES sets(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER UNIQUE,
    ease_factor REAL DEFAULT 2.5,
    interval_days REAL DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review_date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (term_id) REFERENCES terms(id)
  )`);
});

module.exports = db;
