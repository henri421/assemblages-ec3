import { describe, expect, it } from 'vitest';

import { NORME_DE_REFERENCE } from '../src/index';

describe('point d entree', () => {
  it('vise la premiere generation de l EN 1993-1-8', () => {
    expect(NORME_DE_REFERENCE).toBe('EN 1993-1-8:2005');
  });
});
