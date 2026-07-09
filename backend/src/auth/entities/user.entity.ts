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

  @OneToOne(() => MobilityProfile, (profile) => profile.user)
  @JoinColumn()
  mobilityProfile!: MobilityProfile;
}
