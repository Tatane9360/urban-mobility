import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GtfsRoute } from './gtfs-route.entity';
import { GtfsCalendar } from './gtfs-calendar.entity';

@Entity('gtfs_trip')
export class GtfsTrip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  tripId!: string;

  @Column()
  routeDbId!: string;

  @ManyToOne(() => GtfsRoute, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'routeDbId' })
  route!: GtfsRoute;

  @Column()
  calendarDbId!: string;

  @ManyToOne(() => GtfsCalendar, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calendarDbId' })
  calendar!: GtfsCalendar;

  @Column('varchar', { nullable: true })
  tripHeadsign!: string | null;
}
