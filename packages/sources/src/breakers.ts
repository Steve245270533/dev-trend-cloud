import type { CircuitBreakerState, CircuitBreakerStore } from "./types.js";

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 3;
export const CIRCUIT_BREAKER_OPEN_COOLDOWN_MS = 30 * 60 * 1000;

export function createDefaultCircuitBreakerState(): CircuitBreakerState {
  return {
    status: "closed",
    consecutiveFailures: 0,
    openedAt: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    trialInProgress: false,
  };
}

export class MemoryCircuitBreakerStore implements CircuitBreakerStore {
  readonly states = new Map<string, CircuitBreakerState>();

  async get(key: string): Promise<CircuitBreakerState | null> {
    return this.states.get(key) ?? null;
  }

  async allowRequest(key: string, now = new Date()): Promise<boolean> {
    const current = this.states.get(key) ?? createDefaultCircuitBreakerState();

    if (current.status === "closed") {
      this.states.set(key, current);
      return true;
    }

    if (current.status === "open") {
      const openedAtMs = current.openedAt ? Date.parse(current.openedAt) : 0;
      const cooledDown =
        Number.isFinite(openedAtMs) &&
        now.getTime() - openedAtMs >= CIRCUIT_BREAKER_OPEN_COOLDOWN_MS;

      if (!cooledDown) {
        this.states.set(key, current);
        return false;
      }

      const nextState: CircuitBreakerState = {
        ...current,
        status: "half-open",
        trialInProgress: true,
      };
      this.states.set(key, nextState);
      return true;
    }

    if (current.trialInProgress) {
      this.states.set(key, current);
      return false;
    }

    const nextState: CircuitBreakerState = {
      ...current,
      trialInProgress: true,
    };
    this.states.set(key, nextState);
    return true;
  }

  async recordSuccess(
    key: string,
    now = new Date(),
  ): Promise<CircuitBreakerState> {
    const nextState: CircuitBreakerState = {
      status: "closed",
      consecutiveFailures: 0,
      openedAt: null,
      lastFailureAt: this.states.get(key)?.lastFailureAt ?? null,
      lastSuccessAt: now.toISOString(),
      trialInProgress: false,
    };
    this.states.set(key, nextState);
    return nextState;
  }

  async recordFailure(
    key: string,
    now = new Date(),
  ): Promise<CircuitBreakerState> {
    const current = this.states.get(key) ?? createDefaultCircuitBreakerState();
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
    this.states.set(key, nextState);
    return nextState;
  }
}

export function createNoopCircuitBreakerStore(): CircuitBreakerStore {
  return {
    async get() {
      return createDefaultCircuitBreakerState();
    },
    async allowRequest() {
      return true;
    },
    async recordSuccess(_key, now = new Date()) {
      return {
        ...createDefaultCircuitBreakerState(),
        lastSuccessAt: now.toISOString(),
      };
    },
    async recordFailure(_key, now = new Date()) {
      return {
        ...createDefaultCircuitBreakerState(),
        consecutiveFailures: 1,
        lastFailureAt: now.toISOString(),
      };
    },
  };
}
