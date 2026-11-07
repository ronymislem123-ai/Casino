/**
 * Seeded pseudo-random number generation (reproducible simulations).
 * xoshiro128** (Blackman & Vigna) seeded through splitmix32.
 */

export function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

/** Hash an arbitrary string or number into a 32-bit seed. */
export function seedFrom(x: string | number): number {
  const s = String(x);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Derive an independent sub-seed (e.g. per shoe) from a master seed. */
export function subSeed(master: number, index: number): number {
  const sm = splitmix32((master ^ Math.imul(index + 1, 0x9e3779b1)) | 0);
  sm();
  return sm();
}

export class Xoshiro128 {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  constructor(seed: number) {
    const sm = splitmix32(seed | 0);
    this.a = sm() | 0;
    this.b = sm() | 0;
    this.c = sm() | 0;
    this.d = sm() | 0;
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 1;
  }
  reseed(seed: number): void {
    const sm = splitmix32(seed | 0);
    this.a = sm() | 0;
    this.b = sm() | 0;
    this.c = sm() | 0;
    this.d = sm() | 0;
    if ((this.a | this.b | this.c | this.d) === 0) this.a = 1;
  }
  /** uniform 32-bit unsigned integer */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.b, 5), 7), 9);
    const t = this.b << 9;
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c ^= t;
    this.d = rotl(this.d, 11);
    return result >>> 0;
  }
  /** uniform float in [0, 1) */
  next(): number {
    return this.nextU32() / 4294967296;
  }
  /** unbiased integer in [0, n) (Lemire-style rejection) */
  int(n: number): number {
    const limit = 4294967296 - (4294967296 % n);
    let x: number;
    do x = this.nextU32();
    while (x >= limit);
    return x % n;
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}
