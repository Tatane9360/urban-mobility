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

  // ponytail: strict 1-1 (unlike the *DbId FK pattern used for GTFS 1-N
  // relations) — @JoinColumn owning side lives on User since a User always
  // has exactly one Mobility Profile, never the reverse.
  @OneToOne(() => MobilityProfile, (profile) => profile.user)
  @JoinColumn()
  mobilityProfile!: MobilityProfile;
}
