import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentIngestion1726886400000 implements MigrationInterface {
  name = 'CreateDocumentIngestion1726886400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "original_filename" varchar(255) NOT NULL,
        "mime_type" varchar(127) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'ready',
        "latest_version_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "document_versions" (
        "id" uuid NOT NULL,
        "document_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "content_hash" varchar(64) NOT NULL,
        "storage_key" varchar(512) NOT NULL,
        "extracted_text" text NOT NULL,
        "character_count" integer NOT NULL,
        "token_count" integer NOT NULL,
        "chunk_size" integer NOT NULL,
        "chunk_overlap" integer NOT NULL,
        "parser_name" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_versions_document_version" UNIQUE ("document_id", "version_number"),
        CONSTRAINT "UQ_document_versions_content_hash" UNIQUE ("content_hash"),
        CONSTRAINT "FK_document_versions_document" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "document_chunks" (
        "id" uuid NOT NULL,
        "document_version_id" uuid NOT NULL,
        "chunk_index" integer NOT NULL,
        "content" text NOT NULL,
        "token_start" integer NOT NULL,
        "token_end" integer NOT NULL,
        "token_count" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_chunks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_chunks_version_index" UNIQUE ("document_version_id", "chunk_index"),
        CONSTRAINT "FK_document_chunks_version" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "FK_documents_latest_version"
      FOREIGN KEY ("latest_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL
    `);
    await queryRunner.query('CREATE INDEX "IDX_document_chunks_version" ON "document_chunks" ("document_version_id")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_latest_version"');
    await queryRunner.query('DROP TABLE "document_chunks"');
    await queryRunner.query('DROP TABLE "document_versions"');
    await queryRunner.query('DROP TABLE "documents"');
  }
}
