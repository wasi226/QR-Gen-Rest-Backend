import { StatusCodes } from 'http-status-codes';
import { Item } from '../models/Item.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ALLOWED_CATEGORIES = ['FAST FOOD', 'SOFTDRINK', 'SWEETS', 'OTHER'];

export const getAvailableItems = asyncHandler(async (req, res) => {
  const { category } = req.query;

  const query = { available: true };

  if (typeof category === 'string' && category.trim()) {
    const normalizedCategory = category.trim().toUpperCase();
    if (ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      query.category = normalizedCategory;
    }
  }

  const items = await Item.find(query).sort({ createdAt: -1 });
  return res.status(StatusCodes.OK).json({ success: true, data: items });
});

export const getAllItems = asyncHandler(async (_req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  return res.status(StatusCodes.OK).json({ success: true, data: items });
});

export const createItem = asyncHandler(async (req, res) => {
  const { name, price, category = 'OTHER', imageUrl = '', available = true } = req.body;

  if (!name || typeof name !== 'string') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid item name is required.');
  }

  if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid item price is required.');
  }

  const normalizedCategory = String(category || 'OTHER').trim().toUpperCase();
  if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `category must be one of ${ALLOWED_CATEGORIES.join(', ')}`
    );
  }

  const item = await Item.create({
    name: name.trim(),
    price,
    category: normalizedCategory,
    imageUrl: String(imageUrl || '').trim(),
    available: Boolean(available),
  });

  return res.status(StatusCodes.CREATED).json({ success: true, data: item });
});

export const toggleItemAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { available } = req.body;

  if (typeof available !== 'boolean') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'available must be true or false.');
  }

  const item = await Item.findByIdAndUpdate(id, { available }, { new: true });

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Item not found.');
  }

  return res.status(StatusCodes.OK).json({ success: true, data: item });
});

export const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await Item.findByIdAndDelete(id);

  if (!item) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Item not found.');
  }

  return res.status(StatusCodes.OK).json({ success: true, message: 'Item deleted successfully.' });
});
