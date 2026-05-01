import type {
  CircuitBreakerState,
  CircuitBreakerStore,
} from "@devtrend/sources";
import {
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_OPEN_COOLDOWN_MS,
  createDefaultCircuitBreakerState,
} from "@devtrend/sources";
import type { Redis } from "ioredis";

function storageKey(prefix: string, key: string): string {
  return `${prefix}:source-breaker:${key}`;
}

export class RedisCircuitBreakerStore implements CircuitBreakerStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
  ) {}

  async get(key: string): Promise<CircuitBreakerState | null> {
    const value = await this.redis.get(storageKey(this.prefix, key));
    if (!value) {
      return null;
    }

    return JSON.parse(value) as CircuitBreakerState;
  }

  async allowRequest(key: string, now = new Date()): Promise<boolean> {
    const current = (await this.get(key)) ?? createDefaultCircuitBreakerState();

    if (current.status === "closed") {
      await this.set(key, current);
      return true;
    }

    if (current.status === "open") {
      const openedAtMs = current.openedAt ? Date.parse(current.openedAt) : 0;
      const cooledDown =
        Number.isFinite(openedAtMs) &&
        now.getTime() - openedAtMs >= CIRCUIT_BREAKER_OPEN_COOLDOWN_MS;

      if (!cooledDown) {
        await this.set(key, current);
        return false;
      }

      await this.set(key, {
        ...current,
        status: "half-open",
        trialInProgress: true,
      });
      return true;
    }

    if (current.trialInProgress) {
      await this.set(key, current);
      return false;
    }

    await this.set(key, {
      ...current,
      trialInProgress: true,
    });
    return true;
  }

  async recordSuccess(
    key: string,
    now = new Date(),
  ): Promise<CircuitBreakerState> {
    const current = (await this.get(key)) ?? createDefaultCircuitBreakerState();
    const nextState: CircuitBreakerState = {
      status: "closed",
      consecutiveFailures: 0,
      openedAt: null,
      lastFailureAt: current.lastFailureAt,
      lastSuccessAt: now.toISOString(),
      trialInProgress: false,
    };
    await this.set(key, nextState);
    return nextState;
  }

  async recordFailure(
    key: string,
    now = new Date(),
  ): Promise<CircuitBreakerState> {
    const current = (await this.get(key)) ?? createDefaultCircuitBreakerState();
    const consecutiveFailures =
      current.status === "half-open" ? 1 : current.consecutiveFailures + 1;
    const shouldOpen =
      current.status === "half-open" ||
      consecutiveFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD;

    const nextState: CircuitBreakerState = {
      status: shouldOpen ? "open" : "closed",
      consecutiveFailures,
      openedAt: shouldOpen ? now.toISOString() : current.openedAt,
      lastFailureAt: now.toISOString(),
      lastSuccessAt: current.lastSuccessAt,
      trialInProgress: false,
    };
    await this.set(key, nextState);
    return nextState;
  }

  private async set(key: string, state: CircuitBreakerState) {
    await this.redis.set(storageKey(this.prefix, key), JSON.stringify(state));
  }
}
