import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    // Menu item name shown to customers.
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    // Item selling price.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // Category for customer-side filtering.
    category: {
      type: String,
      enum: ['FAST FOOD', 'SOFTDRINK', 'SWEETS', 'OTHER'],
      default: 'OTHER',
    },
    // Optional image URL for item card.
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    // Controls visibility on customer menu.
    available: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Item = mongoose.model('Item', itemSchema);
