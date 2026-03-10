import { Router } from 'express';
import {
  createOrder,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  updateOrderItems,
  cancelOrder,
  getSalesAnalytics,
  deleteOrdersByDate,
  resetTodaysSales,
  getOrderByNumber,
  cancelOrderByNumber,
  getPaymentConfig,
} from '../controllers/orderController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const buildOrderRoutes = (io) => {
  const router = Router();

  // Public endpoints
  router.get('/config/payment', getPaymentConfig); // Public endpoint for payment config
  router.post('/', createOrder(io));
  router.get('/number/:orderNumber', getOrderByNumber); // Public endpoint for order lookup
  router.put('/number/:orderNumber/cancel', cancelOrderByNumber(io)); // Public endpoint for order cancellation

  // Admin/kitchen endpoints.
  router.get('/', requireAuth, requireRoles('ADMIN', 'KITCHEN'), getAllOrders);
  router.get('/analytics/sales', requireAuth, requireRoles('ADMIN'), getSalesAnalytics);
  router.delete('/delete-by-date', requireAuth, requireRoles('ADMIN'), deleteOrdersByDate);
  router.post('/reset-today', requireAuth, requireRoles('ADMIN'), resetTodaysSales(io));
  router.patch('/:id/status', requireAuth, requireRoles('ADMIN', 'KITCHEN'), updateOrderStatus(io));
  router.patch('/:id/payment-status', requireAuth, requireRoles('ADMIN'), updatePaymentStatus(io));
  router.patch('/:id', requireAuth, requireRoles('ADMIN'), updateOrderItems(io));
  router.delete('/:id', requireAuth, requireRoles('ADMIN', 'KITCHEN'), cancelOrder(io));

  return router;
};

export default buildOrderRoutes;
