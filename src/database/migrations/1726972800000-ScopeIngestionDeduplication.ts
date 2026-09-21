import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScopeIngestionDeduplication1726972800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE document_versions DROP CONSTRAINT "UQ_document_versions_content_hash"');
    await queryRunner.query(`ALTER TABLE document_versions
      ADD COLUMN original_filename varchar(255),
      ADD COLUMN mime_type varchar(127),
      ADD COLUMN tokenizer varchar(64) NOT NULL DEFAULT 'o200k_base@gpt-tokenizer-4.0.0'`);
    await queryRunner.query(`UPDATE document_versions v SET original_filename = d.original_filename,
      mime_type = d.mime_type FROM documents d WHERE d.id = v.document_id`);
    await queryRunner.query(`ALTER TABLE document_versions
      ALTER COLUMN original_filename SET NOT NULL,
      ALTER COLUMN mime_type SET NOT NULL,
      ADD CONSTRAINT "UQ_document_versions_ingestion"
        UNIQUE(document_id, content_hash, chunk_size, chunk_overlap, parser_name)`);
    await queryRunner.query('CREATE INDEX "IDX_document_versions_content_hash" ON document_versions(content_hash)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Fails safely if multiple experiment configurations share a hash; never deletes data.
    await queryRunner.query('ALTER TABLE document_versions ADD CONSTRAINT "UQ_document_versions_content_hash" UNIQUE(content_hash)');
    await queryRunner.query('DROP INDEX "IDX_document_versions_content_hash"');
    await queryRunner.query(`ALTER TABLE document_versions
      DROP CONSTRAINT "UQ_document_versions_ingestion",
      DROP COLUMN original_filename, DROP COLUMN mime_type, DROP COLUMN tokenizer`);
  }
}
