import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { DocumentChunk } from './document-chunk.entity';
import { DocumentVersion } from './document-version.entity';
import { Document } from './document.entity';
import { DocumentParserService } from './document-parser.service';
import { ChunkingOptions, IngestionResult } from './ingestion.types';
import { ObjectStorageService } from './object-storage.service';
import { TextNormalizerService } from './text-normalizer.service';
import { TokenChunkerService } from './token-chunker.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    @InjectRepository(DocumentVersion) private readonly versions: Repository<DocumentVersion>,
    @InjectRepository(DocumentChunk) private readonly chunks: Repository<DocumentChunk>,
    private readonly dataSource: DataSource,
    private readonly parser: DocumentParserService,
    private readonly normalizer: TextNormalizerService,
    private readonly chunker: TokenChunkerService,
    private readonly storage: ObjectStorageService,
  ) {}

  async ingest(
    file: Express.Multer.File | undefined,
    options: ChunkingOptions,
    documentId?: string,
  ): Promise<IngestionResult> {
    if (!file) throw new BadRequestException('A document file is required');
    this.chunker.validateOptions(options);

    if (documentId && !(await this.documents.existsBy({ id: documentId }))) {
      throw new NotFoundException('Document was not found');
    }
    const detected = this.parser.detect(file);
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const criteria = {
      contentHash, chunkSize: options.chunkSize, chunkOverlap: options.overlap,
      parserName: detected.type, ...(documentId ? { documentId } : {}),
    };
    const existing = await this.versions.findOne({ where: criteria });
    if (existing) return this.toResult(existing, true);

    const normalizedText = this.normalizer.normalize(await this.parser.extract(detected.type, file.buffer));
    if (!normalizedText) throw new BadRequestException('No extractable text was found. Scanned PDFs require OCR, which is not supported yet.');
    if (normalizedText.length > 2_000_000) throw new BadRequestException('Extracted text exceeds the 2 million character limit');
    const textChunks = this.chunker.chunk(normalizedText, options);
    if (textChunks.length > 10_000) throw new BadRequestException('Too many chunks; reduce overlap or increase chunk size');
    const tokenCount = this.chunker.count(normalizedText);
    let uploadedKey: string | undefined;
    let result: { version: DocumentVersion; duplicate: boolean };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        // Serialize equal content across requests, then versions of an existing document.
        await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [contentHash]);
        const document = documentId
          ? await manager.findOne(Document, { where: { id: documentId }, lock: { mode: 'pessimistic_write' } })
          : manager.create(Document, {
              id: randomUUID(), name: detected.filename, originalFilename: detected.filename,
              mimeType: detected.mimeType, status: 'processing', latestVersionId: null,
            });
        if (!document) throw new NotFoundException('Document was not found');
        const duplicate = await manager.findOne(DocumentVersion, { where: criteria });
        if (duplicate) return { version: duplicate, duplicate: true };

        if (!documentId) await manager.save(Document, document);
        const last = await manager.findOne(DocumentVersion, {
          where: { documentId: document.id }, order: { versionNumber: 'DESC' },
        });
        const versionId = randomUUID();
        const storageKey = 'documents/' + document.id + '/' + versionId;
        await this.storage.put(storageKey, { ...file, mimetype: detected.mimeType }, contentHash);
        uploadedKey = storageKey;
        const version = manager.create(DocumentVersion, {
          id: versionId, documentId: document.id, versionNumber: (last?.versionNumber ?? 0) + 1,
          contentHash, storageKey, originalFilename: detected.filename, mimeType: detected.mimeType,
          tokenizer: 'o200k_base@gpt-tokenizer-4.0.0',
          extractedText: normalizedText, characterCount: normalizedText.length, tokenCount,
          chunkSize: options.chunkSize, chunkOverlap: options.overlap, parserName: detected.type,
        });
        await manager.save(DocumentVersion, version);
        await manager.insert(DocumentChunk, textChunks.map(chunk => ({
          id: randomUUID(), documentVersionId: versionId, chunkIndex: chunk.index,
          content: chunk.content, tokenStart: chunk.tokenStart, tokenEnd: chunk.tokenEnd,
          tokenCount: chunk.tokenCount,
        })));
        document.status = 'ready';
        document.latestVersionId = versionId;
        document.originalFilename = detected.filename;
        document.mimeType = detected.mimeType;
        await manager.save(Document, document);
        return { version, duplicate: false };
      });
    } catch (error) {
      if (uploadedKey) await this.storage.remove(uploadedKey).catch(() => undefined);
      throw error;
    }
    return this.toResult(result.version, result.duplicate);
  }

  async list(): Promise<unknown[]> {
    return this.dataSource.query(`
      SELECT
        d.id,
        d.name,
        d.original_filename AS "originalFilename",
        d.mime_type AS "mimeType",
        d.status,
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        v.id AS "versionId",
        v.version_number AS "versionNumber",
        v.token_count AS "tokenCount",
        v.chunk_size AS "chunkSize",
        v.chunk_overlap AS "overlap",
        v.created_at AS "versionCreatedAt",
        (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id = v.id) AS "chunkCount"
      FROM documents d
      LEFT JOIN document_versions v ON v.id = d.latest_version_id
      ORDER BY d.created_at DESC
    `);
  }

  async getOne(id: string, versionId?: string): Promise<unknown> {
    const document = await this.documents.findOneBy({ id });
    if (!document) throw new NotFoundException(`Document ${id} was not found`);

    const versions = await this.versions.find({
      where: { documentId: id },
      order: { versionNumber: 'DESC' },
      select: {
        id: true,
        versionNumber: true,
        contentHash: true,
        characterCount: true,
        tokenCount: true,
        chunkSize: true,
        chunkOverlap: true,
        parserName: true,
        tokenizer: true,
        originalFilename: true,
        mimeType: true,
        createdAt: true,
      },
    });
    const selectedVersionId = versionId ?? document.latestVersionId;
    if (versionId && !versions.some(version => version.id === versionId)) {
      throw new NotFoundException('Version was not found in this document');
    }
    const chunks = selectedVersionId
      ? await this.chunks.find({
          where: { documentVersionId: selectedVersionId },
          order: { chunkIndex: 'ASC' },
        })
      : [];
    return { ...document, versions, selectedVersionId, chunks };
  }

  private async toResult(version: DocumentVersion, duplicate: boolean): Promise<IngestionResult> {
    const chunkCount = version.chunks?.length ?? await this.chunks.count({
      where: { documentVersionId: version.id },
    });
    return {
      documentId: version.documentId,
      versionId: version.id,
      filename: version.originalFilename,
      mimeType: version.mimeType,
      contentHash: version.contentHash,
      characterCount: version.characterCount,
      tokenCount: version.tokenCount,
      chunkCount,
      chunkSize: version.chunkSize,
      overlap: version.chunkOverlap,
      duplicate,
      createdAt: version.createdAt,
    };
  }
}
