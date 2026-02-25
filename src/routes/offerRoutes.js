import { Router } from 'express';
import {
  createOffer,
  getActiveOffers,
  getAllOffers,
  toggleOfferActive,
  deleteOffer,
} from '../controllers/offerController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

// Customer endpoint.
router.get('/active', getActiveOffers);

// Admin endpoints.
router.get('/', requireAuth, requireRoles('ADMIN', 'KITCHEN'), getAllOffers);
router.post('/', requireAuth, requireRoles('ADMIN'), createOffer);
router.patch('/:id/active', requireAuth, requireRoles('ADMIN'), toggleOfferActive);
router.delete('/:id', requireAuth, requireRoles('ADMIN'), deleteOffer);

export default router;
