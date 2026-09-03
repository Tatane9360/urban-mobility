import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MobilityProfile } from './mobility-profile.entity';

@Entity('app_user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  // Strict 1-1, unlike the *DbId FK pattern used for the GTFS 1-N relations.
  // The owning side is User: a User always has exactly one profile.
  @OneToOne(() => MobilityProfile, (profile) => profile.user)
  @JoinColumn()
  mobilityProfile!: MobilityProfile;
}
