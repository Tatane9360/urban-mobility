import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { FavoriteAddress } from '../../profile/favorite-address';

@Entity('mobility_profile')
export class MobilityProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, (user) => user.mobilityProfile, { onDelete: 'CASCADE' })
  user!: User;

  // jsonb, never simple-array: simple-array splits on a literal comma, which
  // corrupts any address containing one ("1 rue de la Loge, Montpellier").
  // The empty array is supplied explicitly at creation (AuthService.register).
  @Column('jsonb')
  preferredModes!: string[];

  @Column('jsonb')
  favoriteAddresses!: FavoriteAddress[];

  @Column('boolean', { default: false })
  pmrAccessibility!: boolean;
}
