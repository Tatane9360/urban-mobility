import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GtfsImportService } from './gtfs-import.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const config = app.get(ConfigService);
    const url = config.getOrThrow<string>('GTFS_STATIC_URL');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download GTFS zip: HTTP ${response.status}`);
    }
    const zipBuffer = Buffer.from(await response.arrayBuffer());

    const importService = app.get(GtfsImportService);
    await importService.importFromZip(zipBuffer);

    console.log('GTFS import completed successfully.');
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('GTFS import failed:', err);
  process.exit(1);
});
