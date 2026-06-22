const levenshtein = require('fast-levenshtein');
const diff = require('diff');

function normalize(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '');
}

function gradeAnswer(typed, correct) {
  const t = normalize(typed);
  const c = normalize(correct);

  if (t === c) {
    return { correct: true, quality: 5, distance: 0, diff: null };
  }

  const distance = levenshtein.get(t, c);
  const threshold = Math.max(2, Math.floor(c.length * 0.08)); // ~8% tolerance

  let quality;
  if (distance <= threshold) quality = 4;       // minor typo, still "correct"
  else if (distance <= threshold * 3) quality = 2; // close but wrong
  else quality = 0;                              // way off

  const wordDiff = diff.diffWords(c, t);

  return {
    correct: distance <= threshold,
    quality,
    distance,
    diff: wordDiff
  };
}

module.exports = gradeAnswer;
