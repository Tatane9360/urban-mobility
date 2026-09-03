import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database/data-source-options';

// The TypeORM CLI entry point (migration:generate / migration:run). Nest never
// imports this — the running app builds its DataSource through
// DatabaseModule — but both read the same options, so a migration is always
// generated against the database the app connects to.
//
// Globs rather than the entity classes: the CLI runs through ts-node against
// src/, so it needs the files on disk, and a new entity is picked up without
// editing this file.
export default new DataSource({
  ...buildDataSourceOptions(process.env),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
