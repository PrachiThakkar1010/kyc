// Automatic check for cheer wall messages.
// A message that matches is NOT published straight away: it waits in the
// writer panel under "Cheers → Needs review". Add words to the lists below.

// Matched anywhere in the message, even inside other words or with spaces
// removed ("madar chod" is caught too). Keep these specific.
const ALWAYS_BLOCK = [
  // Hindi / Hinglish
  'madarchod', 'maderchod', 'madarchodd', 'behenchod', 'bhenchod', 'behanchod', 'bhanchod',
  'chutiya', 'chutia', 'chootiya', 'bhosdi', 'bhosda', 'bhosadi', 'gaandu', 'gandu',
  'randi', 'lavde', 'lawde', 'lodu', 'jhaatu', 'haramkhor', 'harami', 'kaminey', 'kamina',
  'bkl', 'mc bc',
  // English
  'fuck', 'motherfucker', 'bitch', 'bastard', 'asshole', 'cunt', 'whore', 'nigger', 'nigga',
];

// Matched only as whole words, because they appear inside innocent words.
const WHOLE_WORDS = ['shit', 'dick', 'slut', 'retard', 'fag', 'mc', 'bc', 'lund', 'loda', 'lauda', 'suar', 'kutti'];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

function normalise(text: string) {
  const lower = text.toLowerCase().replace(/[013457@$!]/g, (ch) => LEET[ch] ?? ch);
  const words = lower.replace(/[^a-z\s]/g, ' ').replace(/(.)\1{2,}/g, '$1$1').split(/\s+/).filter(Boolean);
  return { words, joined: words.join(' '), compact: words.join('') };
}

/** Returns a reason if the text should wait for review, or null if it is fine. */
export function checkMessage(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter(Boolean).join(' ');
  if (/(https?:\/\/|www\.|\.com\b|\.in\b|\.xyz\b|t\.me\/|wa\.me\/)/i.test(text)) {
    return 'Contains a link';
  }
  const { words, joined, compact } = normalise(text);
  for (const bad of ALWAYS_BLOCK) {
    if (bad.includes(' ') ? joined.includes(bad) : compact.includes(bad)) return 'Possible abusive language';
  }
  for (const bad of WHOLE_WORDS) {
    if (words.includes(bad)) return 'Possible abusive language';
  }
  if (/(.)\1{9,}/.test(text) || (text.length > 30 && text === text.toUpperCase() && /[A-Z]/.test(text))) {
    return 'Looks like spam';
  }
  return null;
}
