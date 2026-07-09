import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('mobility_profile')
export class MobilityProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.mobilityProfile, { onDelete: 'CASCADE' })
  user!: User;

  @Column('simple-array', { default: '' })
  preferredModes!: string[];

  @Column('simple-array', { default: '' })
  favoriteAddresses!: string[];

  @Column('boolean', { default: false })
  pmrAccessibility!: boolean;
}
