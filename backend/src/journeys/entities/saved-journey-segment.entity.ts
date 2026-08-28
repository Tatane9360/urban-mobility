import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TransportMode } from '../../common/transport-mode.enum';
import { SavedJourney } from './saved-journey.entity';

@Entity('saved_journey_segment')
export class SavedJourneySegment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  journeyDbId!: string;

  @ManyToOne(() => SavedJourney, (journey) => journey.segments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'journeyDbId' })
  journey!: SavedJourney;

  // Preserves the segment's position in the Journey's ordered segment list
  // (see CONTEXT.md, "Journey Segment") — TypeORM doesn't guarantee row order
  // on read without an explicit sort column.
  @Column('int')
  order!: number;

  // ponytail: plain varchar, not a Postgres enum type — no ENUM type exists
  // elsewhere in this codebase either (MobilityProfile.preferredModes stores
  // TransportMode values as a jsonb string array, same avoidance, different
  // column shape). Skips the schema-migration cost of a first ENUM type.
  @Column('varchar')
  mode!: TransportMode;

  @Column('int')
  durationSeconds!: number;

  // Needed by GET /journeys/saved/stats to rebuild the car baseline
  // (distanceKm * CAR_EMISSION_FACTOR_G_PER_KM) — carbonGrams alone can't be
  // inverted back to a distance, the Marche/Vélo emission factor is 0.
  // Defaults to 0 so rows saved before this column existed still aggregate.
  @Column('float', { default: 0 })
  distanceMeters!: number;

  @Column('float')
  carbonGrams!: number;

  @Column()
  fromName!: string;

  @Column('float')
  fromLat!: number;

  @Column('float')
  fromLon!: number;

  @Column()
  toName!: string;

  @Column('float')
  toLat!: number;

  @Column('float')
  toLon!: number;
}
