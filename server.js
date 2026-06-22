const express = require('express');
const cors = require('cors');
const db = require('./db');
const sm2 = require('./sm2');
const gradeAnswer = require('./grade');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/audio'),
  filename: (req, file, cb) => {
    const termId = req.params.termId;
    const ext = path.extname(file.originalname);
    cb(null, `term-${termId}${ext}`);
  }
});

const upload = multer({ storage });
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Get all sets
app.get('/api/sets', (req, res) => {
  db.all('SELECT * FROM sets', (err, rows) => res.json(rows));
});

// Create a set
app.post('/api/sets', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO sets (name) VALUES (?)', [name], function (err) {
    res.json({ id: this.lastID, name });
  });
});

// Add a term to a set
app.post('/api/terms', (req, res) => {
  const { set_id, term, definition, audio_path } = req.body;
  db.run(
    'INSERT INTO terms (set_id, term, definition, audio_path) VALUES (?, ?, ?, ?)',
    [set_id, term, definition, audio_path || null],
    function (err) {
      const termId = this.lastID;
      db.run('INSERT INTO progress (term_id) VALUES (?)', [termId], () => {
        res.json({ id: termId });
      });
    }
  );
});

// Get due terms for a set
app.get('/api/sets/:setId/due', (req, res) => {
  const query = `
    SELECT t.*, p.repetitions, p.ease_factor, p.interval_days, p.next_review_date
    FROM terms t
    JOIN progress p ON p.term_id = t.id
    WHERE t.set_id = ? AND p.next_review_date <= datetime('now')
    ORDER BY p.next_review_date ASC
  `;
  db.all(query, [req.params.setId], (err, rows) => res.json(rows));
});

// Upload a recording for a specific term
app.post('/api/terms/:termId/audio', upload.single('audio'), (req, res) => {
  const audioPath = `/audio/${req.file.filename}`;
  db.run(
    'UPDATE terms SET audio_path = ? WHERE id = ?',
    [audioPath, req.params.termId],
    () => res.json({ audio_path: audioPath })
  );
});

// Submit an answer
app.post('/api/terms/:termId/answer', (req, res) => {
  const { typed, correctDefinition } = req.body;
  const result = gradeAnswer(typed, correctDefinition);

  db.get('SELECT * FROM progress WHERE term_id = ?', [req.params.termId], (err, prog) => {
    const { repetitions, easeFactor, interval } = sm2(
      result.quality,
      prog.repetitions,
      prog.ease_factor,
      prog.interval_days
    );

    const nextReview = `datetime('now', '+${interval} days')`;
    db.run(
      `UPDATE progress SET repetitions = ?, ease_factor = ?, interval_days = ?, next_review_date = ${nextReview} WHERE term_id = ?`,
      [repetitions, easeFactor, interval, req.params.termId],
      () => {
        res.json({ ...result, nextInterval: interval });
      }
    );
  });
});

// Get All terms in a set, ignoring due dates (practice mode)
app.get('/api/sets/:setId/all', (req, res) => {
   const query = `
      select t.*, p.repetitions, p.ease_factor, p.interval_days, p.next_review_date FROM terms t
      Join progress p ON p.term_id = t.id
      WHERE t.set_id = ?
   `;
   db.all(query, [req.params.setId], (err, rows) => res.json(rows));
});

// Get all terms for a set, with audio status
app.get('/api/sets/:setId/terms', (req, res) => {
  db.all(
    'SELECT id, term, definition, audio_path FROM terms WHERE set_id = ?',
    [req.params.setId],
    (err, rows) => res.json(rows)
  );
});

// Update a term's text/definition
app.put('/api/terms/:termId', (req, res) => {
  const { term, definition } = req.body;
  db.run(
    'UPDATE terms SET term = ?, definition = ? WHERE id = ?',
    [term, definition, req.params.termId],
    () => res.json({ success: true })
  );
});

// Delete a term (and its progress row)
app.delete('/api/terms/:termId', (req, res) => {
  db.run('DELETE FROM progress WHERE term_id = ?', [req.params.termId], () => {
    db.run('DELETE FROM terms WHERE id = ?', [req.params.termId], () => {
      res.json({ success: true });
    });
  });
});

// Get a single term's etails
 app.get('/api/terms/:termId', (req, res) => {
   db.get('SELECT * FROM terms WHERE id = ?', [req.params.termId], (err, row) => {
      res.json(row);
   });
 });

// Remove audio association from a term (keeps term/definition intact)
 app.delete('/api/terms/:termId/audio', (req, res) => {
   db.run(
     'UPDATE terms SET audio_path = NULL WHERE id = ?',
     [req.params.termId],
     () => res.json({ success: true })
   );
 });

// Rename a set
 app.put('/api/sets/:setId', (req, res) => {
   const { name } = req.body;
   db.run(
     'UPDATE sets SET name = ? WHERE id = ?',
     [name, req.params.setId],
     () => res.json({ success: true })
   );
 });

app.listen(3000, () => console.log('Running on http://localhost:3000'));

