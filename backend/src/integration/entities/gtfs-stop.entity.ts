import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Entity('gtfs_stop')
export class GtfsStop {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  stopId!: string;

  @Column('varchar', { nullable: true })
  stopCode!: string | null;

  @Column()
  stopName!: string;

  @Index({ spatial: true })
  @Column('geometry', { spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoPoint;

  @Column('varchar', { nullable: true })
  parentStation!: string | null;
}
