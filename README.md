# AgentiQ Backend

NestJS API for document ingestion and infrastructure health.

## Run and verify

Use Docker Compose from the parent repository. It runs migrations before starting the API.
For host development use Node 22.12+, `npm ci`, and `cp .env.example .env`.
Set database and MinIO credentials/ports to match your local stack, then run
`npm run migration:run` and `npm run start:dev`.

```bash
npm run typecheck
npm test
npm run build
# Running stack required; leaves named sample documents for inspection.
API_URL=http://localhost:53000/api npm run test:smoke
```

## Documents API

| Method | Route | Behavior |
| --- | --- | --- |
| POST | /api/documents | Ingest a new document; identical bytes, parser, and chunk settings return the existing version |
| POST | /api/documents/:id/versions | Add changed content or a different chunk configuration to an existing document |
| GET | /api/documents | List documents and latest-version counts |
| GET | /api/documents/:id | Inspect version history and latest chunks |
| GET | /api/documents/:id?versionId=UUID | Inspect chunks for an earlier version belonging to this document |

Uploads use multipart fields `file`, `chunkSize` (200, 500, 1000, or 1500; default 500),
and `overlap` (integer from 0 to chunkSize − 1; default 100).

```bash
curl -F 'file=@notes.md' -F chunkSize=500 -F overlap=100 http://localhost:53000/api/documents
```

Supported formats: UTF-8 TXT/Markdown, text-based PDF, and DOCX. File extensions are
checked alongside PDF/ZIP signatures or strict UTF-8 decoding, then validated by
the parser. Corrupt, encrypted, empty, binary-text, and unsupported uploads return
400. Missing documents/versions return 404; files over 20 MiB return 413.
Scanned PDFs need OCR, which is not included.

The original bytes are stored in the private MinIO bucket `agentiq-documents`.
PostgreSQL holds document identities, immutable ingestion versions, normalized text,
SHA-256 hashes, parser/tokenizer metadata, and ordered chunks. Normalization uses
NFKC, normalized line endings and whitespace. Markdown markup remains text.
Chunking uses `o200k_base` via gpt-tokenizer 4.0.0. Token ranges are half-open;
Unicode boundaries may slightly reduce the selected size or overlap. With zero
overlap, concatenating chunks reproduces the normalized text exactly.

Duplicate checks include chunk settings. To compare the same file under multiple
configurations in one history, upload it to the versions route. Repeating a
historical configuration returns that version without changing the latest pointer.
Concurrent ingestion is serialized by content hash and document row locks.
A database failure after file storage triggers best-effort object cleanup.

## Current boundaries

This is a local, single-user development API; authentication and tenant isolation
are not implemented. Ingestion is synchronous, with limits of 20 MiB per file,
2 million extracted characters, and 10,000 chunks. Parser CPU/memory isolation,
OCR, queues, retries, and crash-orphan cleanup belong to later phases. Do not expose
this development stack as a public upload service.

No embeddings or model API keys are needed for Phase 1.
