import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { FavoriteAddress } from '../../profile/favorite-address';

@Entity('mobility_profile')
export class MobilityProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.mobilityProfile, { onDelete: 'CASCADE' })
  user!: User;

  // ponytail: jsonb, not simple-array — simple-array splits on a literal
  // comma, which corrupts any address containing one (e.g. "1 rue de la
  // Loge, Montpellier"). No DB-level default either, for the same reason
  // simple-array had none: the empty array is supplied explicitly at
  // creation time (see AuthService.register).
  @Column('jsonb')
  preferredModes!: string[];

  @Column('jsonb')
  favoriteAddresses!: FavoriteAddress[];

  @Column('boolean', { default: false })
  pmrAccessibility!: boolean;
}
