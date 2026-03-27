import { Router, Request, Response, NextFunction } from 'express';
import * as settingsRepo from '../repositories/settingsRepository';
import logger from '../services/logger';

const router = Router();

// GET /api/settings - Get all settings
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsRepo.getAll();
    const grouped: Record<string, any[]> = {};
    for (const s of settings) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    res.json({ settings, grouped });
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/:category
router.get('/:category', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsRepo.getByCategory(req.params.category as string);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings - Bulk update settings
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'updates array required' });
      return;
    }
    const results = await settingsRepo.bulkUpdate(updates);
    logger.info(`Settings updated: ${results.map(r => r.key).join(', ')}`);
    res.json({ updated: results });
  } catch (err) {
    next(err);
  }
});

export default router;
