import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'password must be at least 6 characters'),
  organizationName: z.string().min(1, 'organization name is required').max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const session = await mongoose.startSession();
    let user;
    let org;
    try {
      await session.withTransaction(async () => {
        const orgs = await Organization.create([{ name: data.organizationName }], { session });
        org = orgs[0];
        const passwordHash = await User.hashPassword(data.password);
        const users = await User.create(
          [{ email: data.email.toLowerCase(), passwordHash, organization: org._id }],
          { session }
        );
        user = users[0];
      });
    } catch (txErr) {
      // Fallback for standalone Mongo (no replica set => no transactions)
      if (txErr?.code === 20 || /Transaction numbers are only allowed/i.test(txErr?.message || '')) {
        org = await Organization.create({ name: data.organizationName });
        const passwordHash = await User.hashPassword(data.password);
        try {
          user = await User.create({
            email: data.email.toLowerCase(),
            passwordHash,
            organization: org._id,
          });
        } catch (e) {
          await Organization.findByIdAndDelete(org._id);
          throw e;
        }
      } else {
        throw txErr;
      }
    } finally {
      session.endSession();
    }

    const token = signToken({ sub: user._id.toString(), org: org._id.toString() });
    res.status(201).json({
      token,
      user: { id: user._id, email: user.email, organizationId: org._id },
      organization: { id: org._id, name: org.name, defaultLowStockThreshold: org.defaultLowStockThreshold },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await user.verifyPassword(data.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const org = await Organization.findById(user.organization).lean();
    const token = signToken({ sub: user._id.toString(), org: user.organization.toString() });
    res.json({
      token,
      user: { id: user._id, email: user.email, organizationId: user.organization },
      organization: org && {
        id: org._id,
        name: org.name,
        defaultLowStockThreshold: org.defaultLowStockThreshold,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId).lean();
    res.json({
      user: { id: req.user._id, email: req.user.email, organizationId: req.organizationId },
      organization: org && {
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
