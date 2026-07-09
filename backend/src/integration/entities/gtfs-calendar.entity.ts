import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('gtfs_calendar')
export class GtfsCalendar {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  serviceId!: string;

  @Column('boolean')
  monday!: boolean;

  @Column('boolean')
  tuesday!: boolean;

  @Column('boolean')
  wednesday!: boolean;

  @Column('boolean')
  thursday!: boolean;

  @Column('boolean')
  friday!: boolean;

  @Column('boolean')
  saturday!: boolean;

  @Column('boolean')
  sunday!: boolean;

  @Column('date')
  startDate!: string;

  @Column('date')
  endDate!: string;
}
