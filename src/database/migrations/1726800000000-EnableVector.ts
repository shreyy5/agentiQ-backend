import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableVector1726800000000 implements MigrationInterface {
  name = 'EnableVector1726800000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS vector');
  }
}
