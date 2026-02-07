import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { PlaceOrderRequest } from '../types';

const router = Router();

// Get orders
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      status,
      limit,
      after,
      until,
      direction,
      nested,
      side,
      symbols,
    } = req.query;

    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const args: any = {};
    if (status) args.status = status;
    if (limit) args.limit = parseInt(limit as string);
    if (after) args.after = after;
    if (until) args.until = until;
    if (direction) args.direction = direction;
    if (nested !== undefined) args.nested = nested === 'true';
    if (side) args.side = side;
    if (symbols) {
      args.symbols = Array.isArray(symbols) ? symbols : [symbols];
    }

    const result = await mcpClient.callTool({
      name: 'get_orders',
      arguments: args,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders',
    });
  }
});

// Place stock order
router.post('/stock', async (req: Request, res: Response) => {
  try {
    const orderData: PlaceOrderRequest = req.body;
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const args: any = {
      symbol: orderData.symbol,
      side: orderData.side,
      quantity: orderData.quantity,
      type: orderData.type || 'market',
      time_in_force: orderData.time_in_force || 'day',
    };

    if (orderData.limit_price) args.limit_price = orderData.limit_price;
    if (orderData.stop_price) args.stop_price = orderData.stop_price;
    if (orderData.trail_price) args.trail_price = orderData.trail_price;
    if (orderData.trail_percent) args.trail_percent = orderData.trail_percent;
    if (orderData.extended_hours !== undefined)
      args.extended_hours = orderData.extended_hours;
    if (orderData.client_order_id) args.client_order_id = orderData.client_order_id;

    const result = await mcpClient.callTool({
      name: 'place_stock_order',
      arguments: args,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error placing stock order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to place stock order',
    });
  }
});

// Place crypto order
router.post('/crypto', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const args: any = {
      symbol: orderData.symbol,
      side: orderData.side,
      order_type: orderData.order_type || 'market',
      time_in_force: orderData.time_in_force || 'gtc',
    };

    if (orderData.qty) args.qty = orderData.qty;
    if (orderData.notional) args.notional = orderData.notional;
    if (orderData.limit_price) args.limit_price = orderData.limit_price;
    if (orderData.stop_price) args.stop_price = orderData.stop_price;
    if (orderData.client_order_id) args.client_order_id = orderData.client_order_id;

    const result = await mcpClient.callTool({
      name: 'place_crypto_order',
      arguments: args,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error placing crypto order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to place crypto order',
    });
  }
});

// Place option order
router.post('/option', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const args: any = {
      legs: orderData.legs,
      quantity: orderData.quantity,
      order_class: orderData.order_class || 'simple',
      time_in_force: orderData.time_in_force || 'day',
      extended_hours: orderData.extended_hours || false,
      order_type: orderData.order_type || 'market',
    };

    if (orderData.limit_price) args.limit_price = orderData.limit_price;

    const result = await mcpClient.callTool({
      name: 'place_option_order',
      arguments: args,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error placing option order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to place option order',
    });
  }
});

// Cancel order by ID
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const result = await mcpClient.callTool({
      name: 'cancel_order_by_id',
      arguments: { order_id: id },
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`Error canceling order ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel order',
    });
  }
});

// Cancel all orders
router.delete('/', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const result = await mcpClient.callTool({
      name: 'cancel_all_orders',
      arguments: {},
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error canceling all orders:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel all orders',
    });
  }
});

export default router;
