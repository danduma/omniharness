# Browser fetch must not be called as a Manager method

## Context

The Claude model gateway settings Manager accepts a fetch implementation so its requests can be tested. The browser's native `fetch` function was stored directly on the Manager instance and invoked through `this.fetchImpl(...)`.

## Symptom

Clicking **Install and start** changed the button state briefly but sent no request. The visible failure was:

```text
Failed to execute 'fetch' on 'Window': Illegal invocation
```

This made the gateway setup UI appear inert even though the route and installation logic were healthy.

## Root cause

Calling a function through an object property supplies that object as the JavaScript receiver. Native browser `fetch` expects the browser global as its receiver on this runtime, but the Manager instance became the receiver instead.

## Fix

Bind the injected fetch implementation to `globalThis` once in the Manager constructor. Tests can still inject a mock, while the real browser function retains the receiver it requires.

## Verification

- A regression test installs a receiver-sensitive fetch substitute and proves the Manager calls it with the browser global.
- The complete Manager test file passes.
- The real settings UI sends `install` and `start` requests successfully and reaches the visible **Running** state.

## Prevention

Whenever a browser-native function is stored for later use, either wrap it in an arrow function at the boundary or bind it to the browser global. A mock that ignores its receiver is not enough coverage for this class of bug.
