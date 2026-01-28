import { Router } from 'express';
import { z } from 'zod';
import { deckService } from '../services/deck';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Schémas de validation
const deckQuerySchema = z.object({
  includePublic: z.string().optional().transform(val => val === 'true')
});

const importSchema = z.object({
  decklistText: z.string().min(1),
  deckName: z.string().optional()
});

/**
 * GET /api/decks
 * Récupère tous les decks de l'utilisateur
 */
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const query = deckQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const decks = await deckService.getUserDecks(userId, query.includePublic);

    res.json(decks);
  } catch (error) {
    console.error('Erreur récupération decks:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/decks
 * Crée un nouveau deck
 */
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const deck = await deckService.createDeck(userId, req.body);

    res.status(201).json(deck);
  } catch (error) {
    console.error('Erreur création deck:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/decks/:deckId
 * Récupère un deck spécifique
 */
router.get('/:deckId', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    const deck = await deckService.getDeckById(deckId, userId);

    res.json(deck);
  } catch (error) {
    console.error('Erreur récupération deck:', error);
    if (error instanceof Error && (
      error.message === 'Deck non trouvé' || 
      error.message === 'Accès non autorisé à ce deck'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/decks/:deckId
 * Met à jour un deck
 */
router.put('/:deckId', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    const deck = await deckService.updateDeck(deckId, userId, req.body);

    res.json(deck);
  } catch (error) {
    console.error('Erreur mise à jour deck:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && error.message === 'Deck non trouvé ou accès non autorisé') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/decks/:deckId
 * Supprime un deck
 */
router.delete('/:deckId', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    await deckService.deleteDeck(deckId, userId);

    res.json({ message: 'Deck supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression deck:', error);
    if (error instanceof Error && error.message === 'Deck non trouvé ou accès non autorisé') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/decks/:deckId/duplicate
 * Duplique un deck existant
 */
router.post('/:deckId/duplicate', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    const duplicated = await deckService.duplicateDeck(deckId, userId);
    res.status(201).json(duplicated);
  } catch (error) {
    console.error('Erreur duplication deck:', error);
    if (error instanceof Error && (
      error.message === 'Deck non trouvé' ||
      error.message === 'Accès non autorisé à ce deck'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/decks/:deckId/cards
 * Ajoute une carte au deck
 */
router.post('/:deckId/cards', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    const deckCard = await deckService.addCardToDeck(deckId, userId, req.body);

    res.status(201).json(deckCard);
  } catch (error) {
    console.error('Erreur ajout carte au deck:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && (
      error.message === 'Deck non trouvé ou accès non autorisé' ||
      error.message === 'Carte non trouvée'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Bulk upsert deck cards
router.post('/:deckId/cards/bulk', async (req: AuthenticatedRequest, res, next) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;
    const operations = req.body?.operations;
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations doit être un tableau' });
    }
    const result = await deckService.bulkUpsertDeckCards(deckId, userId, operations);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Validate deck
router.get('/:deckId/validate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;
    const result = await deckService.validateDeck(deckId, userId);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && (
      err.message === 'Deck non trouvé' ||
      err.message === 'Accès non autorisé à ce deck'
    )) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/decks/:deckId/cards/:cardId/:board
 * Met à jour une carte dans le deck
 */
router.put('/:deckId/cards/:cardId/:board', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const cardId = req.params.cardId as string;
    const board = req.params.board as string;
    const userId = req.user!.id;

    const deckCard = await deckService.updateDeckCard(deckId, userId, cardId, board, req.body);

    if (!deckCard) {
      return res.status(200).json({ message: 'Carte supprimée du deck' });
    }

    res.json(deckCard);
  } catch (error) {
    console.error('Erreur mise à jour carte du deck:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && (
      error.message === 'Deck non trouvé ou accès non autorisé' ||
      error.message === 'Carte non trouvée dans le deck'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/decks/:deckId/cards/:cardId/:board
 * Supprime une carte du deck
 */
router.delete('/:deckId/cards/:cardId/:board', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const cardId = req.params.cardId as string;
    const board = req.params.board as string;
    const userId = req.user!.id;

    await deckService.removeCardFromDeck(deckId, userId, cardId, board);

    res.json({ message: 'Carte supprimée du deck' });
  } catch (error) {
    console.error('Erreur suppression carte du deck:', error);
    if (error instanceof Error && (
      error.message === 'Deck non trouvé ou accès non autorisé' ||
      error.message === 'Carte non trouvée dans le deck'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/decks/import/mtga
 * Import d'un deck depuis MTGA
 */
router.post('/import/mtga', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { decklistText, deckName } = importSchema.parse(req.body);

    const result = await deckService.importFromMTGA(userId, decklistText, deckName);

    res.status(201).json(result);
  } catch (error) {
    console.error('Erreur import MTGA:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Données invalides', 
        details: error.issues 
      });
    }
    if (error instanceof Error && error.message === 'Aucune carte trouvée dans le decklist') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/decks/:deckId/export/mtga
 * Export d'un deck vers MTGA
 */
router.get('/:deckId/export/mtga', async (req: AuthenticatedRequest, res) => {
  try {
    const deckId = req.params.deckId as string;
    const userId = req.user!.id;

    const result = await deckService.exportToMTGA(deckId, userId);

    res.json(result);
  } catch (error) {
    console.error('Erreur export MTGA:', error);
    if (error instanceof Error && (
      error.message === 'Deck non trouvé' || 
      error.message === 'Accès non autorisé à ce deck'
    )) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
