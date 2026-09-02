// A labelled saved place ("Maison", "Travail"...), stored inside the
// mobility_profile.favoriteAddresses jsonb column — see the ponytail note on
// MobilityProfile for why that column is jsonb rather than simple-array.
export interface FavoriteAddress {
  label: string;
  address: string;
}
