import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const optionalNonNegativeNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (!Number.isNaN(v) && v >= 0), 'must be a non-negative number')
  .nullable();

const productCreateSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(80),
  description: z.string().max(2000).optional().default(''),
  quantityOnHand: z.coerce.number().int().min(0).default(0),
  costPrice: optionalNonNegativeNumber.optional(),
  sellingPrice: optionalNonNegativeNumber.optional(),
  lowStockThreshold: optionalNonNegativeNumber.optional(),
});

const productUpdateSchema = productCreateSchema.partial();

const stockAdjustSchema = z.object({
  delta: z.coerce.number().int(),
  note: z.string().max(500).optional().default(''),
});

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = { organization: req.organizationId };
    if (q && typeof q === 'string' && q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { sku: { $regex: safe, $options: 'i' } },
      ];
    }
    const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const product = await Product.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    }).lean();
    if (!product) return res.status(404).json({ error: 'product not found' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = productCreateSchema.parse(req.body);
    const product = await Product.create({
      ...data,
      organization: req.organizationId,
      lastUpdatedBy: req.user._id,
    });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const data = productUpdateSchema.parse(req.body);
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      { ...data, lastUpdatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'product not found' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/adjust-stock', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const { delta } = stockAdjustSchema.parse(req.body);
    const product = await Product.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!product) return res.status(404).json({ error: 'product not found' });
    const next_qty = product.quantityOnHand + delta;
    if (next_qty < 0) return res.status(400).json({ error: 'quantity cannot go below zero' });
    product.quantityOnHand = next_qty;
    product.lastUpdatedBy = req.user._id;
    await product.save();
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const result = await Product.deleteOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'product not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
