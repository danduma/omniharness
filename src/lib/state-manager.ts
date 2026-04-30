export type StateUpdate<T> = T | ((current: T) => T);
export type StateListener = () => void;

export class StateManager<TState> {
  private state: TState;
  private readonly listeners = new Set<StateListener>();

  constructor(initialState: TState) {
    this.state = initialState;
  }

  getSnapshot() {
    return this.state;
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(updater: StateUpdate<TState>) {
    const nextState = typeof updater === "function"
      ? (updater as (current: TState) => TState)(this.state)
      : updater;

    if (Object.is(nextState, this.state)) {
      return this.state;
    }

    this.state = nextState;
    this.listeners.forEach((listener) => listener());
    return this.state;
  }

  patch(patch: Partial<TState> | ((current: TState) => Partial<TState>)) {
    return this.update((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  }

  setKey<TKey extends keyof TState>(key: TKey, value: StateUpdate<TState[TKey]>) {
    return this.update((current) => ({
      ...current,
      [key]: typeof value === "function"
        ? (value as (currentValue: TState[TKey]) => TState[TKey])(current[key])
        : value,
    }));
  }
}
