import { BadRequestException, Injectable } from '@nestjs/common';
import * as path from 'node:path';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { SupportedDocumentType } from './ingestion.types';

export interface DetectedDocument {
  type: SupportedDocumentType;
  mimeType: string;
  filename: string;
}

const MIME_TYPES: Record<SupportedDocumentType, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  markdown: 'text/markdown',
};

@Injectable()
export class DocumentParserService {
  detect(file: Express.Multer.File): DetectedDocument {
    const filename = this.safeFilename(file.originalname);
    const extension = path.extname(filename).toLowerCase();

    if (extension === '.pdf') {
      if (file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new BadRequestException('The uploaded file does not contain a valid PDF signature');
      }
      return { type: 'pdf', mimeType: MIME_TYPES.pdf, filename };
    }

    if (extension === '.docx') {
      const signature = file.buffer.subarray(0, 2).toString('ascii');
      if (signature !== 'PK') {
        throw new BadRequestException('The uploaded file does not contain a valid DOCX container');
      }
      return { type: 'docx', mimeType: MIME_TYPES.docx, filename };
    }

    if (extension === '.txt' || extension === '.md' || extension === '.markdown') {
      this.decodeUtf8(file.buffer);
      return {
        type: extension === '.txt' ? 'txt' : 'markdown',
        mimeType: extension === '.txt' ? MIME_TYPES.txt : MIME_TYPES.markdown,
        filename,
      };
    }

    throw new BadRequestException('Supported file types are PDF, DOCX, TXT, and Markdown');
  }

  async extract(type: SupportedDocumentType, buffer: Buffer): Promise<string> {
    try {
      if (type === 'txt' || type === 'markdown') return this.decodeUtf8(buffer);
      if (type === 'docx') return (await mammoth.extractRawText({ buffer })).value;

      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        return (await parser.getText()).pages.map(page => page.text).join('\n\n');
      } finally {
        await parser.destroy();
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Could not extract text. The document may be malformed or encrypted.');
    }
  }

  private decodeUtf8(buffer: Buffer): string {
    if (buffer.includes(0)) {
      throw new BadRequestException('The uploaded text file appears to contain binary data');
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new BadRequestException('Text and Markdown files must use UTF-8 encoding');
    }
  }

  private safeFilename(value: string): string {
    const filename = path.basename(value.replace(/\\\\/g, '/')).replace(/[^\p{L}\p{N}._ -]/gu, '_').trim();
    if (!filename) throw new BadRequestException('The uploaded file must have a filename');
    return filename.slice(0, 255);
  }
}
