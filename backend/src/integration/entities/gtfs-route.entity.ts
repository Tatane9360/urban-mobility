import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { GtfsAgency } from './gtfs-agency.entity';

@Entity('gtfs_route')
export class GtfsRoute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  routeId!: string;

  @Column()
  agencyDbId!: string;

  @ManyToOne(() => GtfsAgency, (agency) => agency.routes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'agencyDbId' })
  agency!: GtfsAgency;

  @Column('varchar', { nullable: true })
  routeShortName!: string | null;

  @Column('varchar', { nullable: true })
  routeLongName!: string | null;

  @Column('int')
  routeType!: number;

  @Column('varchar', { nullable: true })
  routeColor!: string | null;

  @Column('varchar', { nullable: true })
  routeTextColor!: string | null;
}
