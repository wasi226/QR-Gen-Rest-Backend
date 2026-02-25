import mongoose from 'mongoose';

const offerItemSchema = new mongoose.Schema(
  {
    // Snapshot name for combo content display.
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Quantity of this item in combo.
    qty: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    // Offer title shown to customers.
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    // Combo price shown on hot deal section.
    comboPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    // List of items included in this combo.
    items: {
      type: [offerItemSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'Offer must include at least one item.',
      },
    },
    // Controls whether combo is visible to customers.
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Offer = mongoose.model('Offer', offerSchema);
