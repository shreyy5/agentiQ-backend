import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: process.env.DATABASE_NAME ?? 'agentiq',
  username: process.env.DATABASE_USER ?? 'agentiq',
  password: process.env.DATABASE_PASSWORD ?? 'agentiq-local',
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
});
