import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/auth/entities/user.entity';

// The middleware runs before guards, so request.userId only exists by the time
// the response finishes. These prove the line actually carries the id — and
// that it never carries the email or the query string, which is the whole
// reason the logging was scoped this way.
describe('Request logging (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let userRepository: Repository<User>;
  let lines: string[];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    userRepository = moduleFixture.get(getRepositoryToken(User));
  });

  beforeEach(() => {
    lines = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        lines.push(String(message));
      });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await userRepository.query(
      'TRUNCATE TABLE app_user, mobility_profile CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const httpLines = () =>
    lines.filter((l) => /^(GET|POST|PATCH|DELETE) /.test(l));

  it('logs an anonymous request with its status and duration', async () => {
    await request(app.getHttpServer()).get('/alerts').expect(200);

    const line = httpLines().find((l) => l.includes('/alerts'));
    expect(line).toMatch(/^GET \/alerts 200 \d+ms anon$/);
  });

  it('carries the authenticated user id, and never their email', async () => {
    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logged@example.com', password: 'correct-horse' });
    const token = (registration.body as { accessToken: string }).accessToken;

    await request(app.getHttpServer())
      .get('/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const line = httpLines().find((l) => l.includes('/profile'));
    expect(line).toMatch(/^GET \/profile 200 \d+ms user=[0-9a-f-]{36}$/);
    expect(lines.join('\n')).not.toContain('logged@example.com');
  });

  it('drops the query string, which carries searched addresses', async () => {
    await request(app.getHttpServer()).get(
      '/geocode?q=12%20rue%20de%20la%20Loge',
    );

    const line = httpLines().find((l) => l.includes('/geocode'));
    expect(line).toContain('GET /geocode ');
    expect(line).not.toContain('rue de la Loge');
  });
});
