/**
 * Gemini API Key Rotation
 * 
 * Reads multiple keys from environment:
 *   GEMINI_API_KEY (primary, not changed)
 *   GEMINI_API_KEY_2, GEMINI_API_KEY_3, ... (fallbacks)
 * 
 * Auto-rotates to next key when current one hits rate limit (429).
 */

let currentKeyIndex = 0;
let allKeys: string[] = [];

function loadKeys(): string[] {
  if (allKeys.length > 0) return allKeys;

  const keys: string[] = [];

  // Primary key
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);

  // Additional keys: GEMINI_API_KEY_2, _3, _4, ...
  for (let i = 2; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) keys.push(key);
  }

  allKeys = keys;
  console.log(`Gemini keys loaded: ${keys.length} key(s) available`);
  return keys;
}

export function getCurrentKey(): string {
  const keys = loadKeys();
  if (keys.length === 0) {
    throw new Error('No GEMINI_API_KEY configured');
  }
  return keys[currentKeyIndex % keys.length];
}

export function rotateOnRateLimit(): string | null {
  const keys = loadKeys();
  if (keys.length <= 1) return null; // No other key to rotate to

  const prevIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;

  // If we've cycled back to the start, all keys are exhausted
  if (currentKeyIndex === 0 && prevIndex === keys.length - 1) {
    console.warn('All Gemini API keys exhausted (rate limited)');
    return null;
  }

  console.log(`Gemini key rotated: key ${prevIndex + 1} → key ${currentKeyIndex + 1} (of ${keys.length})`);
  return keys[currentKeyIndex];
}

export function getKeyCount(): number {
  return loadKeys().length;
}

// Reset for testing
export function resetRotation(): void {
  currentKeyIndex = 0;
}
