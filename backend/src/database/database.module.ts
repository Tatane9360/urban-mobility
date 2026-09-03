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
        const nodeEnv = config.get<string>('NODE_ENV');
        return {
          type: 'postgres' as const,
          // Managed hosts (Neon, Render) give one URL and require SSL; local docker uses discrete vars.
          ...(url
            ? {
                url,
                // The certificate IS verified: Neon and Render both serve
                // certificates signed by a public CA, so the default trust
                // store validates them. Skipping this check would encrypt the
                // connection but accept any certificate presented, leaving
                // password hashes and journey history readable to anyone on
                // the network path. DB_CA_CERT covers a host with a private
                // CA — still verified, just against that root.
                ssl: {
                  rejectUnauthorized: true,
                  ca: config.get<string>('DB_CA_CERT'),
                },
              }
            : {
                host: config.getOrThrow<string>('DB_HOST'),
                port: config.getOrThrow<number>('DB_PORT'),
                username: config.getOrThrow<string>('DB_USERNAME'),
                password: config.getOrThrow<string>('DB_PASSWORD'),
                database: config.getOrThrow<string>('DB_NAME'),
              }),
          autoLoadEntities: true,
          // ponytail: sync in test/dev only, no migrations pipeline yet; add
          // migrations before prod. Allow-list rather than `!== 'production'`:
          // an unset or unexpected NODE_ENV (a 'staging' deploy, a missing
          // container env) must fail closed, since synchronize rewrites the
          // schema at boot and can drop columns.
          synchronize: nodeEnv === 'development' || nodeEnv === 'test',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
