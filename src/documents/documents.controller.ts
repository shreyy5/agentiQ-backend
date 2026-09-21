import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { ChunkingOptions } from './ingestion.types';

const uploadOptions = { limits: { fileSize: 20 * 1024 * 1024, files: 1 } };

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(): Promise<unknown[]> {
    return this.documentsService.list();
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @Query('versionId', new ParseUUIDPipe({ optional: true })) versionId?: string): Promise<unknown> {
    return this.documentsService.getOne(id, versionId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string | undefined>,
  ) {
    return this.documentsService.ingest(file, this.options(body));
  }

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string | undefined>,
  ) {
    return this.documentsService.ingest(file, this.options(body), id);
  }

  private options(body: Record<string, string | undefined>): ChunkingOptions {
    return {
      chunkSize: Number(body.chunkSize ?? 500),
      overlap: Number(body.overlap ?? 100),
    };
  }
}
