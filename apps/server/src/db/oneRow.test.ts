import { describe, expect, it } from 'vitest';
import { oneRow } from './oneRow.ts';

describe('oneRow', () => {
  it('returns the first row', () => {
    expect(oneRow([{ id: 'a' }, { id: 'b' }])).toEqual({ id: 'a' });
  });

  it('throws when no row came back', () => {
    expect(() => oneRow([])).toThrow('Expected one returned row');
  });
});
