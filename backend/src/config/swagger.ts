/**
 * Swagger/OpenAPI configuration for API documentation
 */
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Magicodex API',
      version: '1.0.0',
      description: `
API REST pour l'application Magicodex - Gestionnaire de collection Magic: The Gathering.

## Fonctionnalités

- **Authentification** : Inscription, connexion, refresh token
- **Collection** : Gestion des cartes possédées (ajout, suppression, mise à jour)
- **Decks** : Création et gestion de decks avec validation des formats
- **Cartes** : Recherche et consultation du catalogue Scryfall
- **Sets** : Liste des extensions MTG disponibles
- **Règles** : Consultation des règles officielles

## Authentification

L'API utilise JWT (JSON Web Tokens) pour l'authentification.
- Access Token : Valide 15 minutes
- Refresh Token : Valide 30 jours

Incluez le token dans le header \`Authorization: Bearer <token>\`
      `,
      contact: {
        name: 'Support Magicodex',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
        description: 'Serveur de développement',
      },
      {
        url: '/api',
        description: 'Serveur de production (relatif)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenu via /auth/login',
        },
      },
      schemas: {
        // Auth schemas
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'password123',
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'username', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            username: {
              type: 'string',
              minLength: 3,
              example: 'player42',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'securepassword',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token (15 min)',
            },
            refreshToken: {
              type: 'string',
              description: 'Refresh token (30 jours)',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            isAdmin: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // Card schemas
        Card: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Scryfall UUID' },
            name: { type: 'string' },
            set: { type: 'string', description: 'Code du set (ex: DMU)' },
            setName: { type: 'string' },
            collectorNumber: { type: 'string' },
            rarity: {
              type: 'string',
              enum: ['common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'],
            },
            manaCost: { type: 'string', nullable: true },
            typeLine: { type: 'string' },
            oracleText: { type: 'string', nullable: true },
            power: { type: 'string', nullable: true },
            toughness: { type: 'string', nullable: true },
            imageUris: {
              type: 'object',
              properties: {
                small: { type: 'string' },
                normal: { type: 'string' },
                large: { type: 'string' },
              },
            },
            priceUsd: { type: 'number', nullable: true },
            priceUsdFoil: { type: 'number', nullable: true },
            priceEur: { type: 'number', nullable: true },
            priceEurFoil: { type: 'number', nullable: true },
          },
        },
        // Collection schemas
        CollectionEntry: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            cardId: { type: 'string' },
            quantity: { type: 'integer', minimum: 0 },
            quantityFoil: { type: 'integer', minimum: 0 },
            card: { $ref: '#/components/schemas/Card' },
          },
        },
        AddCardRequest: {
          type: 'object',
          required: ['cardId'],
          properties: {
            cardId: { type: 'string', description: 'Scryfall UUID' },
            quantity: { type: 'integer', minimum: 0, default: 1 },
            quantityFoil: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        CollectionStats: {
          type: 'object',
          properties: {
            totalCards: { type: 'integer' },
            uniqueCards: { type: 'integer' },
            totalValue: {
              type: 'object',
              properties: {
                usd: { type: 'number' },
                eur: { type: 'number' },
              },
            },
            byRarity: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
          },
        },
        // Deck schemas
        Deck: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            format: {
              type: 'string',
              enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'pioneer'],
            },
            isPublic: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            cards: {
              type: 'array',
              items: { $ref: '#/components/schemas/DeckCard' },
            },
          },
        },
        DeckCard: {
          type: 'object',
          properties: {
            cardId: { type: 'string' },
            quantity: { type: 'integer', minimum: 1 },
            isCommander: { type: 'boolean' },
            isSideboard: { type: 'boolean' },
            card: { $ref: '#/components/schemas/Card' },
          },
        },
        CreateDeckRequest: {
          type: 'object',
          required: ['name', 'format'],
          properties: {
            name: { type: 'string', minLength: 1 },
            description: { type: 'string' },
            format: {
              type: 'string',
              enum: ['standard', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'pioneer'],
            },
            isPublic: { type: 'boolean', default: false },
          },
        },
        // Set schemas
        Set: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            name: { type: 'string' },
            releaseDate: { type: 'string', format: 'date' },
            setType: { type: 'string' },
            cardCount: { type: 'integer' },
            iconSvgUri: { type: 'string' },
          },
        },
        // Error schemas
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { type: 'object' },
          },
        },
        // Pagination
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        CursorPaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            nextCursor: { type: 'string', nullable: true },
            hasMore: { type: 'boolean' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Token invalide ou expiré',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Session expirée, veuillez vous reconnecter' },
            },
          },
        },
        NotFoundError: {
          description: 'Ressource non trouvée',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Ressource non trouvée' },
            },
          },
        },
        ValidationError: {
          description: 'Données invalides',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Validation échouée', details: {} },
            },
          },
        },
        RateLimitError: {
          description: 'Trop de requêtes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: { error: 'Trop de requêtes, veuillez patienter' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des utilisateurs' },
      { name: 'Collection', description: 'Gestion de la collection de cartes' },
      { name: 'Decks', description: 'Création et gestion des decks' },
      { name: 'Cards', description: 'Recherche et consultation des cartes' },
      { name: 'Sets', description: 'Extensions Magic: The Gathering' },
      { name: 'Rules', description: 'Règles officielles MTG' },
      { name: 'Admin', description: 'Fonctionnalités administrateur' },
    ],
  },
  apis: ['./src/routes/*.ts'], // Fichiers contenant les annotations JSDoc
};

export const swaggerSpec = swaggerJsdoc(options);
