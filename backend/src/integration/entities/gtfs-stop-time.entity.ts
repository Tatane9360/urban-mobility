import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { GtfsTrip } from './gtfs-trip.entity';
import { GtfsStop } from './gtfs-stop.entity';

@Entity('gtfs_stop_time')
@Unique(['tripDbId', 'stopDbId', 'stopSequence'])
export class GtfsStopTime {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tripDbId!: string;

  @ManyToOne(() => GtfsTrip, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tripDbId' })
  trip!: GtfsTrip;

  @Column()
  stopDbId!: string;

  @ManyToOne(() => GtfsStop, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stopDbId' })
  stop!: GtfsStop;

  @Column()
  arrivalTime!: string;

  @Column()
  departureTime!: string;

  @Column('int')
  stopSequence!: number;
}
