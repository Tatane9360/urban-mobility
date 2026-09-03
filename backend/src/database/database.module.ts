import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './data-source-options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      // Reads process.env directly rather than ConfigService, so the CLI's
      // data-source.ts and the running app build their connection from the
      // exact same function. ConfigModule.forRoot() has already loaded .env
      // into process.env by the time this factory runs.
      useFactory: () => ({
        ...buildDataSourceOptions(process.env),
        autoLoadEntities: true,
        // Schema changes go through migrations (`pnpm migration:run`).
        // synchronize stays on in dev/test only, where the schema is
        // disposable — an allow-list rather than `!== 'production'` so an
        // unset or unexpected NODE_ENV (a 'staging' deploy, a missing
        // container env) fails closed: synchronize rewrites the schema at
        // boot and can drop columns.
        synchronize:
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV === 'test',
      }),
    }),
  ],
})
export class DatabaseModule {}
