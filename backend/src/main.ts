// Import this first so Sentry can instrument everything else.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UrbanFlow Mobility API')
    .setDescription(
      'Multimodal journey planning API for Montpellier Méditerranée Métropole',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

// `void bootstrap()` swallowed the rejection: a second instance would map every
// route, log "successfully started", fail to bind the port, and then stay alive
// polling TaM alongside the first one — which is how a stray dev server ended up
// doubling this service's request rate into HTTP 429s. A process that cannot
// listen serves nothing, so it must exit non-zero and let the supervisor notice.
bootstrap().catch((err: unknown) => {
  Logger.error(err instanceof Error ? err.message : String(err), 'Bootstrap');
  process.exit(1);
});
