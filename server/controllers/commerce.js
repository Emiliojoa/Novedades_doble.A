import * as cart from "../services/cart.js";
import * as orders from "../services/orders.js";
import * as quotes from "../services/quotes.js";
export const getCart = async (req, res) =>
  res.json(await cart.getCart(req.user.id));
export const addItem = async (req, res) =>
  res.json(await cart.addItem(req.user.id, req.data));
export const updateItem = async (req, res) =>
  res.json(
    await cart.updateItem(
      req.user.id,
      Number(req.params.id),
      req.data.quantity,
    ),
  );
export const removeItem = async (req, res) =>
  res.json(await cart.removeItem(req.user.id, Number(req.params.id)));
export const clearCart = async (req, res) =>
  res.json(await cart.clearCart(req.user.id));
export const createOrder = async (req, res) =>
  res.status(201).json(await orders.createOrder(req.user));
export const listOrders = async (req, res) =>
  res.json(await orders.listOrders(req.user));
export const getOrder = async (req, res) =>
  res.json(await orders.getOrder(Number(req.params.id), req.user));
export const createQuote = async (req, res) =>
  res.status(201).json(await quotes.createQuote(req.user.id, req.data));
export const listQuotes = async (req, res) =>
  res.json(await quotes.listQuotes(req.user.id));
