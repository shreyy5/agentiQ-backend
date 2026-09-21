import { Injectable } from '@nestjs/common';

@Injectable()
export class TextNormalizerService {
  normalize(value: string): string {
    return value
      .normalize('NFKC')
      .replace(/\r\n?/g, '\n')
      .replace(/[\t\f\v]+/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
