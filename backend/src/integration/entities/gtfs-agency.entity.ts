import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GtfsRoute } from './gtfs-route.entity';

@Entity('gtfs_agency')
export class GtfsAgency {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  agencyId!: string;

  @Column()
  agencyName!: string;

  @Column()
  agencyUrl!: string;

  @Column()
  agencyTimezone!: string;

  @Column('varchar', { nullable: true })
  agencyLang!: string | null;

  @Column('varchar', { nullable: true })
  agencyPhone!: string | null;

  @OneToMany(() => GtfsRoute, (route) => route.agency)
  routes!: GtfsRoute[];
}
