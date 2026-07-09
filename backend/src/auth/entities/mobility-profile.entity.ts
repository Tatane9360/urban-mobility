import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('mobility_profile')
export class MobilityProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.mobilityProfile, { onDelete: 'CASCADE' })
  user!: User;

  // ponytail: no DB-level default — TypeORM's simple-array reads an empty
  // string default back as [''] (one blank element), not []. The empty
  // array is supplied explicitly at creation time (see AuthService.register).
  @Column('simple-array')
  preferredModes!: string[];

  @Column('simple-array')
  favoriteAddresses!: string[];

  @Column('boolean', { default: false })
  pmrAccessibility!: boolean;
}
