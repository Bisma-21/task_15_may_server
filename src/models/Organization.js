import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    defaultLowStockThreshold: { type: Number, default: 5, min: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Organization', organizationSchema);
