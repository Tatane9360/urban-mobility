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
