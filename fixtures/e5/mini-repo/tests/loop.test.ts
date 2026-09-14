import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planSteps } from '../src/agent/loop.js';

describe('agentLoop helpers', () => {
  it('plans four steps', () => {
    assert.equal(planSteps({ id: 't1', prompt: 'x' }).length, 4);
  });
});
