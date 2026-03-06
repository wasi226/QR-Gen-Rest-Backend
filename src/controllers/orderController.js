import { StatusCodes } from 'http-status-codes';
import { ORDER_STATUSES, PAYMENT_MODES, PAYMENT_STATUSES } from '../constants/index.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getNextOrderNumber } from '../utils/orderNumber.js';
import { paymentConfig } from '../config/payment.js';

const calculateTotal = (items) =>
  items.reduce((sum, item) => sum + item.qty * item.price, 0);

export const getPaymentConfig = asyncHandler(async (req, res) => {
  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      upiId: paymentConfig.upiId,
      payeeName: paymentConfig.payeeName,
      currency: paymentConfig.currency,
    },
  });
});

export const createOrder = (io) =>
  asyncHandler(async (req, res) => {
    const { tableNumber, items, paymentMode, customerName, orderType = 'TABLE', paymentReference } = req.body;

    // Validate orderType
    if (!['TABLE', 'PARCEL'].includes(orderType)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'orderType must be TABLE or PARCEL');
    }

    // Validate tableNumber only if order type is TABLE
    if (orderType === 'TABLE') {
      if (!Number.isInteger(tableNumber) || tableNumber < 1) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid table number is required for dine-in orders.');
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Order must have at least one item.');
    }

    const sanitizedItems = items.map((item) => ({
      name: String(item.name || '').trim(),
      qty: Number(item.qty),
      price: Number(item.price),
    }));

    const hasInvalidItem = sanitizedItems.some(
      (item) => !item.name || !Number.isFinite(item.qty) || item.qty < 1 || !Number.isFinite(item.price) || item.price < 0
    );

    if (hasInvalidItem) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid item structure in order payload.');
    }

    if (!PAYMENT_MODES.includes(paymentMode)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `paymentMode must be one of ${PAYMENT_MODES.join(', ')}`);
    }

    if (customerName && typeof customerName !== 'string') {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'customerName must be a string.');
    }

    const totalAmount = calculateTotal(sanitizedItems);

    const orderData = {
      orderNumber: await getNextOrderNumber(),
      items: sanitizedItems,
      totalAmount,
      paymentMode,
      paymentStatus: paymentMode === 'ONLINE' ? 'PENDING_VERIFICATION' : 'PENDING',
      status: 'NEW',
      orderType,
      createdAt: new Date(),
    };

    // Add tableNumber if order type is TABLE
    if (orderType === 'TABLE') {
      orderData.tableNumber = tableNumber;
    }

    // Add customerName if provided
    if (customerName) {
      orderData.customerName = customerName.trim();
    }

    const order = await Order.create(orderData);

    // Notify all admin/kitchen clients about the new order instantly.
    io.emit('order:new', order);

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Order placed successfully.',
      data: order,
    });
  });

export const getAllOrders = asyncHandler(async (req, res) => {
  const { orderNumber } = req.query;

  let query = {};
  if (orderNumber) {
    query = { orderNumber: Number(orderNumber) };
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });
  return res.status(StatusCodes.OK).json({ success: true, data: orders });
});

export const updateOrderStatus = (io) =>
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `status must be one of ${ORDER_STATUSES.join(', ')}`);
    }

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true });

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    // Broadcast status updates for LCD and admin panel sync.
    io.emit('order:updated', order);

    return res.status(StatusCodes.OK).json({ success: true, data: order });
  });

export const updatePaymentStatus = (io) =>
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!PAYMENT_STATUSES.includes(paymentStatus)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `paymentStatus must be one of ${PAYMENT_STATUSES.join(', ')}`
      );
    }

    const updatePayload = {
      $set: {
        paymentStatus,
      },
      ...(paymentStatus === 'PAID'
        ? {
            $set: {
              paymentStatus,
              paymentVerifiedAt: new Date(),
              paymentVerifiedBy: req.user?.username || 'ADMIN',
            },
          }
        : {
            $unset: {
              paymentVerifiedAt: 1,
              paymentVerifiedBy: 1,
            },
          }),
    };

    const order = await Order.findByIdAndUpdate(id, updatePayload, { new: true });

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    io.emit('order:updated', order);

    return res.status(StatusCodes.OK).json({ success: true, data: order });
  });

export const updateOrderItems = (io) =>
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { items, totalAmount } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Order must have at least one item.');
    }

    const sanitizedItems = items.map((item) => ({
      name: String(item.name || '').trim(),
      qty: Number(item.qty),
      price: Number(item.price),
    }));

    const hasInvalidItem = sanitizedItems.some(
      (item) => !item.name || !Number.isFinite(item.qty) || item.qty < 1 || !Number.isFinite(item.price) || item.price < 0
    );

    if (hasInvalidItem) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid item structure in order payload.');
    }

    const calculatedTotal = calculateTotal(sanitizedItems);

    const order = await Order.findByIdAndUpdate(
      id,
      { items: sanitizedItems, totalAmount: calculatedTotal },
      { new: true }
    );

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    // Notify all clients about the order update
    io.emit('order:updated', order);

    return res.status(StatusCodes.OK).json({ success: true, data: order });
  });

export const cancelOrder = (io) =>
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    // Notify all clients that order was cancelled
    io.emit('order:cancelled', { id, orderNumber: order.orderNumber });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: order,
    });
  });

export const getSalesAnalytics = asyncHandler(async (req, res) => {
  const { date } = req.query;
  
  // Get date range for the day
  let startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  let endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  // If specific date is provided, use that
  if (date) {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      startDate = new Date(parsedDate);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(parsedDate);
      endDate.setHours(23, 59, 59, 999);
    }
  }
  
  // Get all orders for the day (not just DONE orders for better visibility)
  const allOrders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  // Get only completed and paid orders for revenue calculation
  const completedOrders = allOrders.filter(order => 
    order.status === 'DONE' && order.paymentStatus === 'PAID'
  );
  
  // Group items and calculate sales from completed orders
  const salesMap = new Map();
  let totalRevenue = 0;
  let totalItemsQuantity = 0;
  
  completedOrders.forEach(order => {
    order.items.forEach(item => {
      const key = item.name;
      const itemRevenue = item.qty * item.price;
      
      if (salesMap.has(key)) {
        const existing = salesMap.get(key);
        existing.quantity += item.qty;
        existing.revenue += itemRevenue;
      } else {
        salesMap.set(key, {
          name: item.name,
          quantity: item.qty,
          revenue: itemRevenue,
        });
      }
      totalRevenue += itemRevenue;
      totalItemsQuantity += item.qty;
    });
  });
  
  // Convert map to array and sort by revenue (descending)
  const salesData = Array.from(salesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map(item => ({
      ...item,
      // Calculate percentage based on revenue share
      percentage: totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(2) : "0.00",
    }));
  
  // Calculate additional statistics
  const activeOrders = allOrders.filter(order => 
    order.status !== 'DONE' && order.status !== 'CANCELLED'
  ).length;
  
  const pendingPayments = allOrders.filter(order => 
    order.paymentStatus === 'PENDING' || order.paymentStatus === 'PENDING_VERIFICATION'
  ).length;
  
  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      date: startDate.toISOString().split('T')[0],
      totalOrders: allOrders.length,
      completedOrders: completedOrders.length,
      activeOrders,
      pendingPayments,
      totalRevenue: totalRevenue.toFixed(2),
      totalItemsSold: totalItemsQuantity,
      averageOrderValue: completedOrders.length > 0 ? (totalRevenue / completedOrders.length).toFixed(2) : "0.00",
      items: salesData,
    },
  });
});

export const deleteOrdersByDate = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'startDate and endDate are required.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (start > end) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'startDate must be before or equal to endDate.');
  }

  const result = await Order.deleteMany({
    createdAt: { $gte: start, $lte: end },
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: `Deleted ${result.deletedCount} orders between ${startDate} and ${endDate}.`,
    data: {
      deletedCount: result.deletedCount,
    },
  });
});

export const getOrderByNumber = asyncHandler(async (req, res) => {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'orderNumber is required.');
  }

  const order = await Order.findOne({ orderNumber: Number(orderNumber) });

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
  }

  return res.status(StatusCodes.OK).json({
    success: true,
    data: order,
  });
});

export const cancelOrderByNumber = (io) =>
  asyncHandler(async (req, res) => {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'orderNumber is required.');
    }

    const order = await Order.findOneAndUpdate(
      { orderNumber: Number(orderNumber) },
      { status: 'CANCELLED' },
      { new: true }
    );

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    // Notify all clients that order was cancelled
    io.emit('order:updated', {
      id: order._id,
      orderNumber: order.orderNumber,
      status: 'CANCELLED',
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: 'Order cancelled successfully.',
      data: order,
    });
  });
