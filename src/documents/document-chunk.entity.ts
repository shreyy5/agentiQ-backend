import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { DocumentVersion } from './document-version.entity';

@Entity({ name: 'document_chunks' })
@Unique('UQ_document_chunks_version_index', ['documentVersionId', 'chunkIndex'])
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_version_id', type: 'uuid' })
  documentVersionId!: string;

  @ManyToOne(() => DocumentVersion, (version) => version.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_version_id' })
  documentVersion!: DocumentVersion;

  @Column({ name: 'chunk_index', type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'token_start', type: 'integer' })
  tokenStart!: number;

  @Column({ name: 'token_end', type: 'integer' })
  tokenEnd!: number;

  @Column({ name: 'token_count', type: 'integer' })
  tokenCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
