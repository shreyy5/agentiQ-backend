import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentVersion } from './document-version.entity';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'mime_type', length: 127 })
  mimeType!: string;

  @Column({ length: 32, default: 'ready' })
  status!: string;

  @Column({ name: 'latest_version_id', type: 'uuid', nullable: true })
  latestVersionId!: string | null;

  @OneToMany(() => DocumentVersion, (version) => version.document)
  versions!: DocumentVersion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
