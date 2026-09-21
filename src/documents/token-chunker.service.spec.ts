import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { TokenChunkerService } from './token-chunker.service';

describe('TokenChunkerService', () => {
  const service = new TokenChunkerService();

  it('creates overlapping token windows without exceeding the selected size', () => {
    const text = Array.from({ length: 900 }, (_, index) => `token-${index}`).join(' ');
    const chunks = service.chunk(text, { chunkSize: 200, overlap: 40 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenCount <= 200)).toBe(true);
    expect(chunks[1].tokenStart).toBe(160);
    expect(chunks.at(-1)?.tokenEnd).toBe(service.count(text));
  });

  it('preserves Unicode and whitespace across zero-overlap windows', () => {
    const text = 'नमस्ते 世界 🧪 text '.repeat(250);
    const chunks = service.chunk(text, { chunkSize: 200, overlap: 0 });
    expect(chunks.map(chunk => chunk.content).join('')).toBe(text);
    expect(chunks.every(chunk => !chunk.content.includes('�'))).toBe(true);
  });

  it('treats special-token spellings as ordinary document text', () => {
    const text = 'Source text contains <|endoftext|> literally.';
    expect(service.chunk(text, { chunkSize: 200, overlap: 0 })[0].content).toBe(text);
  });

  it('rejects unsupported experiment sizes and invalid overlaps', () => {
    expect(() => service.chunk('text', { chunkSize: 300, overlap: 10 })).toThrow(BadRequestException);
    expect(() => service.chunk('text', { chunkSize: 500, overlap: 500 })).toThrow(BadRequestException);
  });
});
