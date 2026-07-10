import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { IntegrationModule } from './integration/integration.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { RoutingModule } from './routing/routing.module';
import { JourneysModule } from './journeys/journeys.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // ponytail: generous global limit (100 req/min/IP) — high enough to never
    // interfere with real usage or the existing e2e suite's rapid-fire
    // requests; the rate-limiting behavior itself is proven by a dedicated
    // e2e spec with its own much stricter local ThrottlerModule.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DatabaseModule,
    IntegrationModule,
    AuthModule,
    ProfileModule,
    RoutingModule,
    JourneysModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
