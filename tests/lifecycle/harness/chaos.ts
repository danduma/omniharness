/**
 * Seeded chaos policy for the lifecycle harness.
 *
 * Faults are injected by the client, never by the server. Every
 * decision goes through `shouldFire`, which is deterministic given the
 * seed — so any failure replays exactly by re-running with the same
 * seed.
 */
export interface ChaosPolicy {
  dropSseRate: number;
  flakeFetchRate: number;
  flakeStatuses: number[];
}

export const NO_CHAOS: ChaosPolicy = {
  dropSseRate: 0,
  flakeFetchRate: 0,
  flakeStatuses: [],
};

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    // mulberry32 — small, fast, deterministic.
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  bernoulli(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new Error("pick() called on empty array");
    }
    return values[Math.floor(this.next() * values.length)]!;
  }
}

export class Chaos {
  private readonly rng: SeededRng;

  constructor(public readonly seed: number, public readonly policy: ChaosPolicy = NO_CHAOS) {
    this.rng = new SeededRng(seed);
  }

  shouldDropSse(): boolean {
    return this.rng.bernoulli(this.policy.dropSseRate);
  }

  shouldFlakeFetch(): boolean {
    return this.rng.bernoulli(this.policy.flakeFetchRate);
  }

  pickFlakeStatus(): number {
    return this.policy.flakeStatuses.length > 0
      ? this.rng.pick(this.policy.flakeStatuses)
      : 503;
  }
}
