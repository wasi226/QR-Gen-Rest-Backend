import { Counter } from '../models/Counter.js';
import { env } from '../config/env.js';

export const getNextOrderNumber = async () => {
  const counterId = 'orderNumber';

  // Initialize counter document on first order.
  const existingCounter = await Counter.findById(counterId);

  if (!existingCounter) {
    const createdCounter = await Counter.create({
      _id: counterId,
      seq: env.orderNumberStart,
    });

    return createdCounter.seq;
  }

  // Atomic increment for subsequent orders.
  const updatedCounter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true }
  );

  return updatedCounter.seq;
};
