// Types partagés pour l'application Modern Magicodex

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Set {
  id: string;
  scryfallId: string;
  code: string;
  name: string;
  nameFr?: string;
  type: string;
  releasedAt?: string;
  cardCount?: number;
  iconSvgUri?: string;
  searchUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  scryfallId: string;
  oracleId?: string;
  name: string;
  nameFr?: string;
  manaCost?: string;
  cmc?: number;
  typeLine: string;
  typeLineFr?: string;
  oracleText?: string;
  oracleTextFr?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors: string[];
  colorIdentity: string[];
  rarity: string;
  collectorNumber: string;
  lang: string;
  imageUris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
  };
  prices?: {
    usd?: string;
    usd_foil?: string;
    eur?: string;
    eur_foil?: string;
  };
  // Numeric price in EUR when available (server-provided); prefer this over prices.eur
  priceEur?: number | null;
  // Numeric foil price in EUR when available; prefer this over prices.eur_foil
  priceEurFoil?: number | null;
  // Server-side extra/variant flag for consistent filtering
  isExtra?: boolean;
  legalities?: Record<string, string>;
  set: Set;
  setId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCard {
  id: string;
  quantity: number;
  quantityFoil: number;
  condition: 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
  language: string;
  notes?: string;
  card: Card;
  cardId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  format: string;
  archetype?: string;
  colors: string[];
  isPublic: boolean;
  mainboardCount: number;
  sideboardCount: number;
  userId: string;
  user: User;
  deckCards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id: string;
  quantity: number;
  board: 'main' | 'side' | 'maybe';
  card: Card;
  cardId: string;
  deckId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  userCards: UserCard[];
  stats: CollectionStats;
}

export interface CollectionStats {
  totalCards: number;
  totalFoils: number;
  totalValue: number;
  setCompletion: SetCompletion[];
  colorDistribution: ColorDistribution;
  rarityDistribution: RarityDistribution;
}

export interface SetCompletion {
  set: Set;
  totalCards: number;
  ownedCards: number;
  completionPercentage: number;
}

export interface ColorDistribution {
  white: number;
  blue: number;
  black: number;
  red: number;
  green: number;
  colorless: number;
  multicolor: number;
}

export interface RarityDistribution {
  common: number;
  uncommon: number;
  rare: number;
  mythic: number;
}

export interface DeckStats {
  manaCurve: ManaCurveData[];
  colorDistribution: ColorDistribution;
  typeDistribution: TypeDistribution;
  avgCmc: number;
  landCount: number;
  creatureCount: number;
  spellCount: number;
}

export interface ManaCurveData {
  cmc: number;
  count: number;
}

export interface TypeDistribution {
  creatures: number;
  planeswalkers: number;
  instants: number;
  sorceries: number;
  enchantments: number;
  artifacts: number;
  lands: number;
  other: number;
}

export interface SearchFilters {
  query?: string;
  colors?: string[];
  types?: string[];
  rarities?: string[];
  sets?: string[];
  cmc?: {
    min?: number;
    max?: number;
  };
  format?: string;
  owned?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
  timestamp: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Form types
export interface DeckFormData {
  name: string;
  description?: string;
  format: string;
  archetype?: string;
  isPublic: boolean;
}

export interface CardInDeck {
  card: Card;
  quantity: number;
  board: 'main' | 'side' | 'maybe';
}

// Wishlist / Trade list
export type ListType = 'WISHLIST' | 'TRADE';
export interface UserListItem {
  id: string;
  userId: string;
  cardId: string;
  type: ListType;
  quantity: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  card: Card;
}

// MTG Constants
export const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'] as const;
export const MTG_RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;
export const MTG_FORMATS = [
  'Standard',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
  'Commander',
  'Historic',
  'Alchemy',
  'Brawl',
  'Pauper'
] as const;

export const MTG_ARCHETYPES = [
  'Aggro',
  'Control',
  'Midrange',
  'Combo',
  'Tempo',
  'Ramp',
  'Prison',
  'Burn',
  'Mill'
] as const;

export type MTGColor = typeof MTG_COLORS[number];
export type MTGRarity = typeof MTG_RARITIES[number];
export type MTGFormat = typeof MTG_FORMATS[number];
export type MTGArchetype = typeof MTG_ARCHETYPES[number];
