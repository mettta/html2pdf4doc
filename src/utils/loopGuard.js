// Generic iteration guard used to abort loops that stop making progress.
// Usage:
//   import { createLoopGuard } from '../utils/loopGuard.js';
//   const tick = createLoopGuard({ label: 'grid.split', limit: rows.length * 6, assert: this._assert });
//   while (...) {
//     tick();
//     ...
//   }

/**
 * Create a simple iteration guard.
 *
 * @param {Object} params
 * @param {string} params.label - diagnostic label for logging/asserts.
 * @param {number|Function} params.limit - max allowed iterations before throwing.
 *   A function returns the current limit and is called on each iteration.
 *   Use it when the loop works on a collection that grows while the loop runs.
 * @param {boolean} [params.assert] - whether to emit console.assert diagnostics.
 * @returns {Function} call on each iteration; throws once limit exceeded.
 */
export function createLoopGuard({ label = 'loop', limit, assert = false } = {}) {
  const getSafeLimit = () => {
    const value = typeof limit === 'function' ? limit() : limit;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  };
  let iterations = 0;

  return () => {
    iterations += 1;
    const safeLimit = getSafeLimit();
    if (iterations <= safeLimit) return;
    const diagnostic = { label, iterations, limit: safeLimit };
    assert && console.assert(
      false,
      `\n\n ⛔ [${label}] ♾️ loop guard triggered`,
      diagnostic
    );
    throw new Error(`\n ⛔ [${label}] ♾️ loop guard triggered`);
  };
}

