# AgentiQ Backend

NestJS API for AgentiQ. It currently provides a health endpoint and the initial pgvector migration.

## Local development

```bash
npm install
cp .env.example .env
npm run migration:run
npm run start:dev
```

For the full stack, use Docker Compose from the parent repository.
