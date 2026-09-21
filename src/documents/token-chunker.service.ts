import { BadRequestException, Injectable } from '@nestjs/common';
import { decode, encode } from 'gpt-tokenizer';
import {
  ChunkingOptions,
  SUPPORTED_CHUNK_SIZES,
  TextChunk,
} from './ingestion.types';

@Injectable()
export class TokenChunkerService {
  chunk(text: string, options: ChunkingOptions): TextChunk[] {
    this.validateOptions(options);
    const tokens = encode(text, { disallowedSpecial: new Set() });
    if (tokens.length === 0) return [];

    const chunks: TextChunk[] = [];
    let tokenStart = 0;
    let characterStart = 0;
    while (tokenStart < tokens.length) {
      let tokenEnd = Math.min(tokenStart + options.chunkSize, tokens.length);
      let content = decode(tokens.slice(tokenStart, tokenEnd));
      // BPE tokens may split a UTF-8 code point. End on an intact source substring.
      while (!text.startsWith(content, characterStart) && tokenEnd > tokenStart) {
        content = decode(tokens.slice(tokenStart, --tokenEnd));
      }
      if (tokenEnd === tokenStart) throw new BadRequestException('Could not find a valid text boundary');
      chunks.push({ content, index: chunks.length, tokenStart, tokenEnd, tokenCount: tokenEnd - tokenStart });
      if (chunks.length > 10_000) throw new BadRequestException('Too many chunks; reduce overlap or increase chunk size');
      if (tokenEnd === tokens.length) break;
      let nextStart = Math.max(tokenStart + 1, tokenEnd - options.overlap);
      let suffix = decode(tokens.slice(nextStart, tokenEnd));
      while (!content.endsWith(suffix) && nextStart < tokenEnd) {
        suffix = decode(tokens.slice(++nextStart, tokenEnd));
      }
      characterStart += content.length - suffix.length;
      tokenStart = nextStart;
    }
    return chunks;
  }

  count(text: string): number {
    return encode(text, { disallowedSpecial: new Set() }).length;
  }

  validateOptions(options: ChunkingOptions): void {
    if (!SUPPORTED_CHUNK_SIZES.includes(options.chunkSize as (typeof SUPPORTED_CHUNK_SIZES)[number])) {
      throw new BadRequestException(
        `chunkSize must be one of: ${SUPPORTED_CHUNK_SIZES.join(', ')}`,
      );
    }
    if (!Number.isInteger(options.overlap) || options.overlap < 0) {
      throw new BadRequestException('overlap must be a non-negative integer');
    }
    if (options.overlap >= options.chunkSize) {
      throw new BadRequestException('overlap must be smaller than chunkSize');
    }
  }
}
