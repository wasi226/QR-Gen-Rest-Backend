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
    const { tableNumber, items, paymentMode, customerName, orderType = 'TABLE' } = req.body;

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

    let paymentStatus;
    if (paymentMode === 'CASH') {
      paymentStatus = 'PAID';
    } else if (paymentMode === 'ONLINE') {
      paymentStatus = 'PENDING_VERIFICATION';
    } else {
      paymentStatus = 'PENDING';
    }

    const orderData = {
      orderNumber: await getNextOrderNumber(),
      items: sanitizedItems,
      totalAmount,
      paymentMode,
      paymentStatus,
      status: 'NEW',
      orderType,
      createdAt: new Date(),
    };

    // Add payment verification details for CASH orders
    if (paymentMode === 'CASH') {
      orderData.paymentVerifiedAt = new Date();
      orderData.paymentVerifiedBy = 'CUSTOMER';
    }

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
    console.log(`Emitting order:new event for order ${order.orderNumber}`);
    io.emit('order:new', order);

    return res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Order placed successfully.',
      data: order,
    });
  });

export const getAllOrders = asyncHandler(async (req, res) => {
  const { orderNumber, date, today } = req.query;

  let query = {};
  
  // Filter by order number if provided
  if (orderNumber) {
    query = { orderNumber: Number(orderNumber) };
  }
  
  // Filter by specific date if provided
  if (date) {
    const parsedDate = new Date(date + 'T00:00:00.000Z');
    if (Number.isFinite(parsedDate.getTime())) {
      const startDate = new Date(parsedDate);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(parsedDate);
      endDate.setUTCHours(23, 59, 59, 999);
      
      query.createdAt = { $gte: startDate, $lte: endDate };
    }
  }
  
  // Filter by today's date if today=true is provided
  if (today === 'true') {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    
    query.createdAt = { $gte: startDate, $lte: endDate };
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

    // Prepare the update object
    const updateObject = { status };
    
    // If order is being marked as DONE, automatically handle payment for CASH orders
    if (status === 'DONE') {
      // We need to get the current order first to check payment mode
      const currentOrder = await Order.findById(id);
      if (!currentOrder) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
      }
      
      // If it's a CASH order and payment is still PENDING, mark it as PAID
      if (currentOrder.paymentMode === 'CASH' && currentOrder.paymentStatus === 'PENDING') {
        updateObject.paymentStatus = 'PAID';
        updateObject.paymentVerifiedAt = new Date();
        updateObject.paymentVerifiedBy = req.user?.username || 'SYSTEM';
      }
    }

    const order = await Order.findByIdAndUpdate(id, updateObject, { new: true });

    if (!order) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Order not found.');
    }

    // Broadcast status updates for LCD and admin panel sync.
    console.log(`Emitting order:updated event for order ${order.orderNumber} - Status: ${order.status}, PaymentStatus: ${order.paymentStatus}`);
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
    const { items } = req.body;

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
  
  // Always use UTC to avoid timezone issues, but adjust for local business day
  const now = new Date();
  let startDate, endDate;
  
  // If specific date is provided, use that
  if (date) {
    const parsedDate = new Date(date + 'T00:00:00.000Z');
    if (Number.isFinite(parsedDate.getTime())) {
      startDate = new Date(parsedDate);
      startDate.setUTCHours(0, 0, 0, 0);
      
      endDate = new Date(parsedDate);
      endDate.setUTCHours(23, 59, 59, 999);
    } else {
      // If invalid date provided, default to today
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // Default to today only - strict daily reset
    startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }
  
  // Get all orders for the specific day only
  const allOrders = await Order.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: -1 });
  
  // Get completed orders - DONE status for both cash and online orders
  const completedOrdersCount = allOrders.filter(order => 
    order.status === 'DONE'
  ).length;
  
  // Get revenue-eligible orders: 
  // - CASH orders that are DONE (payment is immediate)
  // - ONLINE orders that are DONE AND PAID
  const revenueEligibleOrders = allOrders.filter(order => 
    order.status === 'DONE' && (
      (order.paymentMode === 'CASH' && order.paymentStatus !== 'PENDING_VERIFICATION') ||
      (order.paymentMode === 'ONLINE' && order.paymentStatus === 'PAID')
    )
  );
  
  // Group items and calculate sales from revenue-eligible orders
  const salesMap = new Map();
  let totalRevenue = 0;
  let totalItemsQuantity = 0;
  
  revenueEligibleOrders.forEach(order => {
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
    (order.paymentMode === 'ONLINE' && order.paymentStatus === 'PENDING_VERIFICATION') ||
    order.paymentStatus === 'PENDING'
  ).length;
  
  // Format the response date to ensure consistency
  const responseDate = startDate.toISOString().split('T')[0];
  
  return res.status(StatusCodes.OK).json({
    success: true,
    data: {
      date: responseDate,
      totalOrders: allOrders.length,
      completedOrders: completedOrdersCount,
      activeOrders,
      pendingPayments,
      totalRevenue: totalRevenue.toFixed(2),
      totalItemsSold: totalItemsQuantity,
      averageOrderValue: revenueEligibleOrders.length > 0 ? (totalRevenue / revenueEligibleOrders.length).toFixed(2) : "0.00",
      items: salesData,
      // Add metadata for debugging
      meta: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
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

// Reset today's sales data (delete all orders from today)
export const resetTodaysSales = (io) => asyncHandler(async (req, res) => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  const result = await Order.deleteMany({
    createdAt: { $gte: startDate, $lte: endDate },
  });

  // Emit event to refresh all connected clients
  io.emit('sales:reset', {
    message: 'Today\'s sales data has been reset',
    resetAt: new Date(),
    deletedCount: result.deletedCount
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    message: `Successfully reset today's sales data. Deleted ${result.deletedCount} orders.`,
    data: {
      deletedCount: result.deletedCount,
      resetAt: new Date(),
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
