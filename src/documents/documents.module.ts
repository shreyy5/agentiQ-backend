import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentChunk } from './document-chunk.entity';
import { DocumentVersion } from './document-version.entity';
import { Document } from './document.entity';
import { DocumentParserService } from './document-parser.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ObjectStorageService } from './object-storage.service';
import { TextNormalizerService } from './text-normalizer.service';
import { TokenChunkerService } from './token-chunker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentVersion, DocumentChunk])],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentParserService,
    TextNormalizerService,
    TokenChunkerService,
    ObjectStorageService,
  ],
})
export class DocumentsModule {}
