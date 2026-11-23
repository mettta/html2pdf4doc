import { expect } from 'chai';
import { createLoopGuard } from '../../../src/utils/loopGuard.js';

describe('createLoopGuard', () => {
  it('throws once the fixed limit is exceeded', () => {
    const tick = createLoopGuard({ label: 'test', limit: 2 });
    tick();
    tick();
    expect(() => tick()).to.throw('[test] ♾️ loop guard triggered');
  });

  it('reads a function limit on each iteration', () => {
    // The guarded collection grows while the loop runs.
    const rows = ['row'];
    const tick = createLoopGuard({ label: 'test', limit: () => rows.length * 2 });
    tick();
    tick();
    rows.push('slice');
    tick();
    tick();
    expect(() => tick()).to.throw('[test] ♾️ loop guard triggered');
  });
});
