export class KeyRotation {
  private keys: string[] = [];
  private currentIndex: number = 0;
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.loadKeys();
  }

  private loadKeys() {
    if (this.keys.length > 0) return;
    
    const primary = process.env[this.prefix];
    if (primary) this.keys.push(primary);

    for (let i = 2; i <= 10; i++) {
      const key = process.env[`${this.prefix}_${i}`];
      if (key) this.keys.push(key);
    }
    
    console.log(`${this.prefix} keys loaded: ${this.keys.length} key(s) available`);
  }

  public getCurrentKey(): string {
    if (this.keys.length === 0) {
      this.loadKeys();
      if (this.keys.length === 0) {
        throw new Error(`No ${this.prefix} configured`);
      }
    }
    return this.keys[this.currentIndex % this.keys.length];
  }

  public rotateOnRateLimit(): string | null {
    if (this.keys.length <= 1) return null;

    const prevIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;

    if (this.currentIndex === 0 && prevIndex === this.keys.length - 1) {
      console.warn(`All ${this.prefix} API keys exhausted (rate limited)`);
      return null;
    }

    console.log(`${this.prefix} key rotated: key ${prevIndex + 1} → key ${this.currentIndex + 1} (of ${this.keys.length})`);
    return this.keys[this.currentIndex];
  }

  public getKeyCount(): number {
    if (this.keys.length === 0) this.loadKeys();
    return this.keys.length;
  }
}

export const geminiKeys = new KeyRotation('GEMINI_API_KEY');
export const groqKeys = new KeyRotation('GROQ_API_KEY');
