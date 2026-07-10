import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { SavedJourneySegment } from './saved-journey-segment.entity';

@Entity('saved_journey')
export class SavedJourney {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userDbId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userDbId' })
  user!: User;

  @Column('int')
  durationSeconds!: number;

  @Column('float')
  carbonGrams!: number;

  @Column({ default: false })
  degraded!: boolean;

  @OneToMany(() => SavedJourneySegment, (segment) => segment.journey, {
    cascade: true,
  })
  segments!: SavedJourneySegment[];

  @Column({ type: 'timestamptz', default: () => 'now()' })
  savedAt!: Date;
}
