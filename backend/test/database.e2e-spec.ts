import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';

describe('Database connection (e2e)', () => {
  let moduleFixture: TestingModule;
  let dataSource: DataSource;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('initializes the TypeORM DataSource', () => {
    expect(dataSource.isInitialized).toBe(true);
  });

  it('connects to a database with the PostGIS extension active', async () => {
    const result: [{ postgis_version: string }] = await dataSource.query(
      'SELECT PostGIS_version() as postgis_version;',
    );

    expect(result[0].postgis_version).toBeDefined();
  });
});
