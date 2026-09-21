import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DocumentParserService } from './document-parser.service';

function upload(filename: string, contents: Buffer): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: contents.length,
    buffer: contents,
    stream: undefined as never,
    destination: '',
    filename,
    path: '',
  };
}

describe('DocumentParserService', () => {
  const service = new DocumentParserService();

  it('detects and extracts UTF-8 text and Markdown files', async () => {
    const file = upload('../notes.md', Buffer.from('# Notes\n\nHello'));
    expect(service.detect(file)).toEqual({
      type: 'markdown',
      mimeType: 'text/markdown',
      filename: 'notes.md',
    });
    await expect(service.extract('markdown', file.buffer)).resolves.toContain('Hello');
  });

  it('rejects a PDF extension without a PDF signature', () => {
    expect(() => service.detect(upload('fake.pdf', Buffer.from('not a pdf')))).toThrow(
      BadRequestException,
    );
  });

  it('rejects binary data disguised as text', () => {
    expect(() => service.detect(upload('binary.txt', Buffer.from([65, 0, 66])))).toThrow(
      BadRequestException,
    );
  });
});
