/**
 * Test utilities and mocks for backend testing
 */
import { vi } from 'vitest';

// Mock Prisma client for unit tests
export const mockPrismaClient = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  set: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  card: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  userCard: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  deck: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  deckCard: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrismaClient)),
};

// Mock JWT for auth tests
export const mockJwt = {
  sign: vi.fn(() => 'mock-token'),
  verify: vi.fn(() => ({ userId: 'test-user-id' })),
};

// Sample test data
export const testUsers = {
  regular: {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: '$2a$12$hashedpassword', // bcrypt hash
    firstName: 'Test',
    lastName: 'User',
    isAdmin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  admin: {
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'adminuser',
    password: '$2a$12$hashedpassword',
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const testSets = {
  standard: {
    id: 'set-1',
    scryfallId: 'scryfall-set-1',
    code: 'dmu',
    name: 'Dominaria United',
    nameFr: 'Dominaria uni',
    type: 'expansion',
    releasedAt: new Date('2022-09-09'),
    cardCount: 281,
    iconSvgUri: 'https://example.com/icon.svg',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const testCards = {
  creature: {
    id: 'card-1',
    scryfallId: 'scryfall-card-1',
    oracleId: 'oracle-1',
    name: 'Serra Angel',
    nameFr: 'Ange de Serra',
    manaCost: '{3}{W}{W}',
    cmc: 5,
    typeLine: 'Creature — Angel',
    typeLineFr: 'Créature : ange',
    oracleText: 'Flying, vigilance',
    oracleTextFr: 'Vol, vigilance',
    power: '4',
    toughness: '4',
    colors: '["W"]',
    colorIdentity: '["W"]',
    rarity: 'rare',
    collectorNumber: '1',
    lang: 'en',
    imageUris: '{"small":"https://example.com/small.jpg"}',
    prices: '{"eur":"1.50","usd":"2.00"}',
    priceEur: 1.50,
    legalities: '{"standard":"legal","modern":"legal"}',
    isExtra: false,
    setId: 'set-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  land: {
    id: 'card-2',
    scryfallId: 'scryfall-card-2',
    oracleId: 'oracle-2',
    name: 'Plains',
    nameFr: 'Plaine',
    manaCost: null,
    cmc: 0,
    typeLine: 'Basic Land — Plains',
    typeLineFr: 'Terrain de base : plaine',
    oracleText: '{T}: Add {W}.',
    power: null,
    toughness: null,
    colors: '[]',
    colorIdentity: '["W"]',
    rarity: 'common',
    collectorNumber: '250',
    lang: 'en',
    imageUris: '{"small":"https://example.com/plains.jpg"}',
    prices: '{"eur":"0.10"}',
    priceEur: 0.10,
    legalities: '{"standard":"legal","modern":"legal"}',
    isExtra: false,
    setId: 'set-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

export const testDecks = {
  standard: {
    id: 'deck-1',
    name: 'White Weenie',
    description: 'Aggro deck',
    format: 'Standard',
    archetype: 'Aggro',
    colors: '["W"]',
    isPublic: false,
    mainboardCount: 60,
    sideboardCount: 15,
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

// Helper to reset all mocks
export function resetMocks() {
  vi.clearAllMocks();
}
