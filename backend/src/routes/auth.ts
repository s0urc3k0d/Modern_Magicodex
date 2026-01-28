import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { 
  REFRESH_TOKEN_COOKIE, 
  getRefreshTokenCookieOptions, 
  getClearCookieOptions,
  TOKEN_CONFIG 
} from '../config/cookies';
import { recordAuthLogin, recordAuthRegister } from '../monitoring/metrics';
import { logger } from '../utils/logger';

const router = Router();
const authLogger = logger.child({ module: 'auth' });

// Token configuration (imported from cookies.ts)
const ACCESS_TOKEN_EXPIRY = TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY;
const REFRESH_TOKEN_EXPIRY_DAYS = TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS;

// Helper to generate secure refresh token
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Helper to create refresh token in DB
async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  });
  
  return token;
}

// Helper to clean expired tokens for a user
async function cleanExpiredTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() }
    }
  });
}

// Helper to set refresh token cookie
function setRefreshTokenCookie(res: any, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, getRefreshTokenCookieOptions());
}

// Helper to clear refresh token cookie
function clearRefreshTokenCookie(res: any): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  username: z.string().min(3, 'Minimum 3 caractères'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Créer un nouveau compte
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Inscription réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Données invalides ou utilisateur existant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/register', authLimiter, async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username }
        ]
      }
    });
    
    if (existingUser) {
      const field = existingUser.email === validatedData.email ? 'email' : 'nom d\'utilisateur';
      return res.status(400).json({ 
        error: `Un utilisateur avec cet ${field} existe déjà` 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email: validatedData.email,
        username: validatedData.username,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        isAdmin: false
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        createdAt: true
      }
    });
    
    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Configuration JWT manquante' });
    }
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    
    // Generate refresh token
    const refreshToken = await createRefreshToken(newUser.id);
    
    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);
    
    authLogger.info({ userId: newUser.id, username: newUser.username }, 'User registered');
    recordAuthRegister(true);

    res.status(201).json({
      token,
      user: newUser,
    });
  } catch (error) {
    authLogger.error({ error }, 'Register error');
    recordAuthRegister(false);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Se connecter
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Connexion réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Identifiants incorrects
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/login', authLimiter, async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Configuration JWT manquante' });
    }
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    
    // Generate refresh token and clean old ones
    await cleanExpiredTokens(user.id);
    const refreshToken = await createRefreshToken(user.id);
    
    // Set refresh token as httpOnly cookie
    setRefreshTokenCookie(res, refreshToken);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    
    authLogger.info({ userId: user.id }, 'User logged in');
    recordAuthLogin(true);

    res.json({
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    authLogger.error({ error }, 'Login error');
    recordAuthLogin(false);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Se déconnecter
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    
    if (refreshToken) {
      // Delete refresh token from DB
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken }
      });
    }
    
    // Clear the cookie
    clearRefreshTokenCookie(res);
    
    authLogger.info({ userId: req.user?.id }, 'User logged out');
    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    authLogger.error({ error }, 'Logout error');
    clearRefreshTokenCookie(res);
    res.json({ message: 'Déconnexion réussie' });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Rafraîchir le token d'accès (utilise le cookie httpOnly)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Nouveau token généré
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Refresh token invalide ou expiré
 */
// Refresh access token using refresh token from httpOnly cookie
router.post('/refresh', async (req, res) => {
  try {
    // Get refresh token from httpOnly cookie
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token manquant' });
    }
    
    // Find refresh token in DB
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });
    
    if (!storedToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Refresh token invalide' });
    }
    
    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Refresh token expiré' });
    }
    
    // Generate new access token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Configuration JWT manquante' });
    }
    const newAccessToken = jwt.sign(
      { userId: storedToken.userId },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    
    // Rotate refresh token for extra security
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const newRefreshToken = await createRefreshToken(storedToken.userId);
    
    // Set new refresh token cookie
    setRefreshTokenCookie(res, newRefreshToken);
    
    // Clean expired tokens
    await cleanExpiredTokens(storedToken.userId);
    
    authLogger.debug({ userId: storedToken.userId }, 'Token refreshed');

    res.json({
      token: newAccessToken
    });
  } catch (error) {
    authLogger.error({ error }, 'Refresh token error');
    clearRefreshTokenCookie(res);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(user);
  } catch (error) {
    authLogger.error({ error }, 'Profile fetch error');
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit faire au moins 6 caractères')
});

router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return res.json({ message: 'Mot de passe mis à jour' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Données invalides', details: error.issues });
    }
    authLogger.error({ error }, 'Password change error');
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
