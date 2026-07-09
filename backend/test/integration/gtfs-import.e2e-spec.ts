import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GtfsAgency } from '../../src/integration/entities/gtfs-agency.entity';
import { GtfsRoute } from '../../src/integration/entities/gtfs-route.entity';
import { GtfsImportService } from '../../src/integration/gtfs-import.service';

describe('GtfsImportService (e2e)', () => {
  let moduleFixture: TestingModule;
  let service: GtfsImportService;
  let agencyRepository: Repository<GtfsAgency>;
  let routeRepository: Repository<GtfsRoute>;
  const fixtureZip = readFileSync(
    join(__dirname, '../fixtures/gtfs-fixture.zip'),
  );

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    service = moduleFixture.get(GtfsImportService);
    agencyRepository = moduleFixture.get(getRepositoryToken(GtfsAgency));
    routeRepository = moduleFixture.get(getRepositoryToken(GtfsRoute));
  });

  afterEach(async () => {
    await agencyRepository.query(
      'TRUNCATE TABLE gtfs_route, gtfs_agency CASCADE',
    );
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('imports agencies and routes from a GTFS zip, resolving the route -> agency relation', async () => {
    await service.importFromZip(fixtureZip);

    const agencies = await agencyRepository.find();
    expect(agencies).toHaveLength(1);
    expect(agencies[0]).toMatchObject({
      agencyId: 'TAM',
      agencyName: "Transports de l'agglomération de Montpellier",
    });

    const routes = await routeRepository.find({ relations: ['agency'] });
    expect(routes).toHaveLength(2);
    const routeL1 = routes.find((r) => r.routeId === 'L1');
    expect(routeL1).toMatchObject({
      routeShortName: '1',
      routeLongName: 'Mosson - Odysseum',
      routeType: 0,
    });
    expect(routeL1?.agency.agencyId).toBe('TAM');
  });

  it('is idempotent: importing the same zip twice does not create duplicates', async () => {
    await service.importFromZip(fixtureZip);
    await service.importFromZip(fixtureZip);

    expect(await agencyRepository.count()).toBe(1);
    expect(await routeRepository.count()).toBe(2);
  });
});
