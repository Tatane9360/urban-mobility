import { DataSourceOptions } from 'typeorm';

// The connection settings, in one place: DatabaseModule builds the running
// app's DataSource from these, and data-source.ts hands the same ones to the
// TypeORM CLI. Duplicating them would let the CLI generate migrations against
// a different database than the app actually runs on.
export function buildDataSourceOptions(
  env: NodeJS.ProcessEnv,
): DataSourceOptions {
  const url = env.DATABASE_URL;

  return {
    type: 'postgres',
    // Managed hosts (Neon, Render) give one URL and require SSL; local docker
    // uses discrete vars.
    ...(url
      ? {
          url,
          // The certificate IS verified: Neon and Render both serve
          // certificates signed by a public CA, so the default trust store
          // validates them. Skipping this check would encrypt the connection
          // but accept any certificate presented, leaving password hashes and
          // journey history readable to anyone on the network path.
          // DB_CA_CERT covers a host with a private CA — still verified, just
          // against that root.
          ssl: { rejectUnauthorized: true, ca: env.DB_CA_CERT },
        }
      : {
          host: required(env, 'DB_HOST'),
          port: Number(required(env, 'DB_PORT')),
          username: required(env, 'DB_USERNAME'),
          password: required(env, 'DB_PASSWORD'),
          database: required(env, 'DB_NAME'),
        }),
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
