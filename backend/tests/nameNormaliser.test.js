const { normaliseName, buildNormalisedName } = require('../services/nameNormaliser');

const members = [
  { id: 1, name: 'Aisha' },
  { id: 2, name: 'Rohan' },
  { id: 3, name: 'Priya' },
  { id: 4, name: 'Meera' },
  { id: 5, name: 'Dev'   },
  { id: 6, name: 'Sam'   },
];

test('lowercase exact match', () => {
  const result = normaliseName('priya', members);
  expect(result.status).toBe('exact');
  expect(result.resolvedName).toBe('Priya');
  expect(result.userId).toBe(3);
});

test('trailing space + lowercase', () => {
  const result = normaliseName('rohan ', members);
  expect(result.status).toBe('exact');
  expect(result.resolvedName).toBe('Rohan');
  expect(result.userId).toBe(2);
});

test('fuzzy match should NOT auto-resolve', () => {
  const result = normaliseName('Priya S', members);
  expect(result.status).toBe('fuzzy');
  expect(result.resolvedName).toBe(null);
  expect(result.candidates.length).toBeGreaterThan(0);
});

test('completely unknown name', () => {
  const result = normaliseName("Dev's friend Kabir", members);
  expect(result.status).toBe('unknown');
});

test('buildNormalisedName utility', () => {
  expect(buildNormalisedName('priya')).toBe('Priya');
  expect(buildNormalisedName('rohan ')).toBe('Rohan');
  expect(buildNormalisedName('AISHA')).toBe('Aisha');
});
