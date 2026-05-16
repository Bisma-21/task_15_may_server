import { Router } from 'express';
import { z } from 'zod';
import Organization from '../models/Organization.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  defaultLowStockThreshold: z.coerce.number().int().min(0),
});

router.get('/', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId).lean();
    if (!org) return res.status(404).json({ error: 'organization not found' });
    res.json({
      organization: {
        id: org._id,
        name: org.name,
        defaultLowStockThreshold: org.defaultLowStockThreshold,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const org = await Organization.findByIdAndUpdate(
      req.organizationId,
      { defaultLowStockThreshold: data.defaultLowStockThreshold },
      { new: true, runValidators: true }
    ).lean();
    if (!org) return res.status(404).json({ error: 'organization not found' });
    res.json({
      organization: {
        id: org._id,
        name: org.name,
        defaultLowStockThreshold: org.defaultLowStockThreshold,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
