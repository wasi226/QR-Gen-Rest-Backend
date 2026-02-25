import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    // Snapshot of item name at order time.
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Quantity selected by customer.
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    // Snapshot of item unit price at order time.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    tableNumber: {
      type: Number,
      min: 1,
    },
    orderType: {
      type: String,
      enum: ['TABLE', 'PARCEL'],
      default: 'TABLE',
      required: true,
    },
    // Optional customer name for billing reference.
    customerName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: 'Order must contain at least one item.',
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMode: {
      type: String,
      enum: ['CASH', 'ONLINE'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PENDING_VERIFICATION', 'PAID'],
      default: 'PENDING',
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    paymentVerifiedAt: {
      type: Date,
    },
    paymentVerifiedBy: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ['NEW', 'PREPARING', 'READY', 'DONE'],
      default: 'NEW',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const Order = mongoose.model('Order', orderSchema);
