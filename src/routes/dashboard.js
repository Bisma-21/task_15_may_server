import { Router } from 'express';
import Product from '../models/Product.js';
import Organization from '../models/Organization.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId).lean();
    const defaultThreshold = org?.defaultLowStockThreshold ?? 5;

    const products = await Product.find({ organization: req.organizationId })
      .select('name sku quantityOnHand lowStockThreshold sellingPrice')
      .lean();

    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + (p.quantityOnHand || 0), 0);
    const lowStock = products
      .filter((p) => {
        const threshold = p.lowStockThreshold ?? defaultThreshold;
        return p.quantityOnHand <= threshold;
      })
      .map((p) => ({
        id: p._id,
        name: p.name,
        sku: p.sku,
        quantityOnHand: p.quantityOnHand,
        lowStockThreshold: p.lowStockThreshold ?? defaultThreshold,
      }))
      .sort((a, b) => a.quantityOnHand - b.quantityOnHand);

    res.json({
      totalProducts,
      totalQuantity,
      defaultLowStockThreshold: defaultThreshold,
      lowStock,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
