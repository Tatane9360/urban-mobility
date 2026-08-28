import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        return {
          type: 'postgres' as const,
          // Managed hosts (Neon, Render) give one URL and require SSL; local docker uses discrete vars.
          ...(url
            ? { url, ssl: { rejectUnauthorized: false } }
            : {
                host: config.getOrThrow<string>('DB_HOST'),
                port: config.getOrThrow<number>('DB_PORT'),
                username: config.getOrThrow<string>('DB_USERNAME'),
                password: config.getOrThrow<string>('DB_PASSWORD'),
                database: config.getOrThrow<string>('DB_NAME'),
              }),
          autoLoadEntities: true,
          // ponytail: sync in test/dev only, no migrations pipeline yet; add migrations before prod
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
