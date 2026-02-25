import { Router } from 'express';
import {
  createItem,
  getAllItems,
  getAvailableItems,
  toggleItemAvailability,
  deleteItem,
} from '../controllers/itemController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

// Customer menu endpoint (available items only).
router.get('/available', getAvailableItems);

// Admin endpoints.
router.get('/', requireAuth, requireRoles('ADMIN', 'KITCHEN'), getAllItems);
router.post('/', requireAuth, requireRoles('ADMIN'), createItem);
router.patch('/:id/availability', requireAuth, requireRoles('ADMIN'), toggleItemAvailability);
router.delete('/:id', requireAuth, requireRoles('ADMIN'), deleteItem);

export default router;
