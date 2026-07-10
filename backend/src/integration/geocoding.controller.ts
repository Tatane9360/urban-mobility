import { Controller, Get, Query } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { GeocodeQueryDto } from './dto/geocode-query.dto';
import { GeocodeResult } from './geocoding.types';

@Controller('geocode')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get()
  search(@Query() query: GeocodeQueryDto): Promise<GeocodeResult[]> {
    return this.geocodingService.geocode(query.q);
  }
}
