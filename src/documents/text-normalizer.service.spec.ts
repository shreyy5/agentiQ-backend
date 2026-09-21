import { describe, expect, it } from 'vitest';
import { TextNormalizerService } from './text-normalizer.service';

describe('TextNormalizerService', () => {
  it('normalizes unicode, line endings, whitespace, and blank lines', () => {
    const service = new TextNormalizerService();
    expect(service.normalize('  Ａ  title\r\n\r\n\r\nbody\t text  ')).toBe(
      'A title\n\nbody text',
    );
  });
});
