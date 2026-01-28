import { Router } from 'express';

const router = Router();

// User routes
router.get('/profile', (req, res) => {
  res.json({ message: 'Get user profile - to be implemented' });
});

router.put('/profile', (req, res) => {
  res.json({ message: 'Update user profile - to be implemented' });
});

export default router;
