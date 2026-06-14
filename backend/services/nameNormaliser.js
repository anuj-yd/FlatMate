const levenshtein = require('fast-levenshtein');

function buildNormalisedName(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Proper case each word
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function normaliseName(rawName, canonicalMembers) {
  if (!rawName) return { status: 'unknown', resolvedName: null, userId: null };

  const cleanedRaw = rawName.trim().toLowerCase();

  // Step 2 — Try exact match (case-insensitive)
  for (const member of canonicalMembers) {
    if (member.name.toLowerCase() === cleanedRaw) {
      return { status: 'exact', resolvedName: member.name, userId: member.id };
    }
  }

  // Step 3 — Levenshtein distance
  const candidates = [];
  for (const member of canonicalMembers) {
    const distance = levenshtein.get(cleanedRaw, member.name.toLowerCase());
    if (distance <= 3) {
      candidates.push({ member, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);

  if (candidates.length === 1 && candidates[0].distance <= 1) {
    // TIER 1 auto-fix (e.g. "priya" -> "Priya", distance = 0, but since exact match caught distance 0, this catches distance 1)
    // Actually the instructions say "distance <= 1". If "priya" came in, exact match caught it.
    return { status: 'exact', resolvedName: candidates[0].member.name, userId: candidates[0].member.id };
  }

  if (candidates.length >= 1) {
    // Any remaining candidates with distance > 1 or multiple candidates
    // TIER 3 fuzzy match
    return { status: 'fuzzy', resolvedName: null, userId: null, candidates };
  }

  // Step 4 — No match at all
  return { status: 'unknown', resolvedName: null, userId: null };
}

module.exports = {
  buildNormalisedName,
  normaliseName
};
