export const SUPPORTED_CHUNK_SIZES = [200, 500, 1000, 1500] as const;
export type SupportedDocumentType = 'pdf' | 'docx' | 'txt' | 'markdown';

export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
}

export interface TextChunk {
  content: string;
  index: number;
  tokenStart: number;
  tokenEnd: number;
  tokenCount: number;
}

export interface IngestionResult {
  documentId: string;
  versionId: string;
  filename: string;
  mimeType: string;
  contentHash: string;
  characterCount: number;
  tokenCount: number;
  chunkCount: number;
  chunkSize: number;
  overlap: number;
  duplicate: boolean;
  createdAt: Date;
}
