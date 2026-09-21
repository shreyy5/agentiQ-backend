import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DocumentChunk } from './document-chunk.entity';
import { Document } from './document.entity';

@Entity({ name: 'document_versions' })
@Unique('UQ_document_versions_document_version', ['documentId', 'versionNumber'])
@Unique('UQ_document_versions_ingestion', ['documentId', 'contentHash', 'chunkSize', 'chunkOverlap', 'parserName'])
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document, (document) => document.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: Document;

  @Column({ name: 'version_number', type: 'integer' })
  versionNumber!: number;

  @Index('IDX_document_versions_content_hash')
  @Column({ name: 'content_hash', length: 64 })
  contentHash!: string;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'mime_type', length: 127 })
  mimeType!: string;

  @Column({ length: 64, default: 'o200k_base@gpt-tokenizer-4.0.0' })
  tokenizer!: string;

  @Column({ name: 'storage_key', length: 512 })
  storageKey!: string;

  @Column({ name: 'extracted_text', type: 'text' })
  extractedText!: string;

  @Column({ name: 'character_count', type: 'integer' })
  characterCount!: number;

  @Column({ name: 'token_count', type: 'integer' })
  tokenCount!: number;

  @Column({ name: 'chunk_size', type: 'integer' })
  chunkSize!: number;

  @Column({ name: 'chunk_overlap', type: 'integer' })
  chunkOverlap!: number;

  @Column({ name: 'parser_name', length: 64 })
  parserName!: string;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.documentVersion)
  chunks!: DocumentChunk[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
