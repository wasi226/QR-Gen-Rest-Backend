import { StatusCodes } from 'http-status-codes';
import { Offer } from '../models/Offer.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getActiveOffers = asyncHandler(async (_req, res) => {
  const offers = await Offer.find({ active: true }).sort({ createdAt: -1 });
  return res.status(StatusCodes.OK).json({ success: true, data: offers });
});

export const getAllOffers = asyncHandler(async (_req, res) => {
  const offers = await Offer.find().sort({ createdAt: -1 });
  return res.status(StatusCodes.OK).json({ success: true, data: offers });
});

export const createOffer = asyncHandler(async (req, res) => {
  const { title, comboPrice, items, active = true } = req.body;

  if (!title || typeof title !== 'string') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid offer title is required.');
  }

  if (typeof comboPrice !== 'number' || Number.isNaN(comboPrice) || comboPrice < 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid comboPrice is required.');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Offer must include at least one item.');
  }

  const sanitizedItems = items.map((item) => ({
    name: String(item.name || '').trim(),
    qty: Number(item.qty || 1),
  }));

  const hasInvalidItem = sanitizedItems.some((item) => !item.name || !Number.isFinite(item.qty) || item.qty < 1);
  if (hasInvalidItem) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid item format in offer items.');
  }

  const offer = await Offer.create({
    title: title.trim(),
    comboPrice,
    items: sanitizedItems,
    active: Boolean(active),
  });

  return res.status(StatusCodes.CREATED).json({ success: true, data: offer });
});

export const toggleOfferActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  if (typeof active !== 'boolean') {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'active must be true or false.');
  }

  const offer = await Offer.findByIdAndUpdate(id, { active }, { new: true });

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offer not found.');
  }

  return res.status(StatusCodes.OK).json({ success: true, data: offer });
});

export const deleteOffer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const offer = await Offer.findByIdAndDelete(id);

  if (!offer) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offer not found.');
  }

  return res.status(StatusCodes.OK).json({ success: true, message: 'Offer deleted successfully.' });
});
