import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database/data-source-options';

// The TypeORM CLI entry point (migration:generate / migration:run). Nest never
// imports this — the running app builds its DataSource through
// DatabaseModule — but both read the same options, so a migration is always
// generated against the database the app connects to.
//
// Globs rather than the entity classes, so a new entity is picked up without
// editing this file. __dirname resolves to src/ under ts-node (local
// migration:generate) and to dist/ after a build (the deploy running
// migration:run), which is why the extension is derived from this file's own
// rather than hard-coded to .ts — a .ts glob finds nothing in dist/.
const extension = __filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  ...buildDataSourceOptions(process.env),
  entities: [`${__dirname}/**/*.entity.${extension}`],
  migrations: [`${__dirname}/migrations/*.${extension}`],
});
