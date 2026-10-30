/**
 * Seedable PRNG with Fisher-Yates shuffle, uniform choice, and state get/set.
 */

                                     

export class MulberryRng                {
          s        ;

  constructor(seed         = 0) {
    this.s = seed >>> 0;
  }

  random()         {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randrange(n        )         {
    if (n <= 0) return 0;
    return Math.floor(this.random() * n);
  }

  choice   (arr     )    {
    if (!arr.length) {
      throw new Error("Cannot choose from empty array");
    }
    return arr[this.randrange(arr.length)];
  }

  shuffle   (arr     )       {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randrange(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  sample   (arr     , k        )      {
    if (k <= 0) return [];
    if (k >= arr.length) return arr.slice();
    const copy = arr.slice();
    const result      = [];
    for (let i = 0; i < k; i++) {
      const j = i + this.randrange(copy.length - i);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
      result.push(copy[i]);
    }
    return result;
  }

  getState()          {
    return this.s;
  }

  setState(s         )       {
    this.s = s          ;
  }
}

export function newRng(seed         = 0)              {
  return new MulberryRng(seed);
}
