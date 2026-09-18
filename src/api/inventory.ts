import { apiGet, apiPost } from './client';
import type {
  InventoryItem,
  InventoryMovement,
  CreateInventoryItemPayload,
  StockAdjustmentPayload,
} from '../types';

/**
 * Inventory API
 *
 * Backend contract (from Inventory.js):
 * - inventory.list: GET ?action=inventory.list
 *   Query params: Category, Status (optional filters)
 * - inventory.create: POST { action: "inventory.create", payload: {...} }
 * - inventory.stockIn: POST { action: "inventory.stockIn", payload: {...} }
 * - inventory.stockOut: POST { action: "inventory.stockOut", payload: {...} }
 * - inventory.movements: GET ?action=inventory.movements&Item_ID=<id>
 *
 * Item_ID format: ITM-XXX (server-generated, immutable)
 * Movement_ID format: MOV-XXX (server-generated, append-only)
 * Status is DERIVED from Current_Quantity vs Minimum_Stock_Level:
 *   - Current_Quantity >= Minimum_Stock_Level → "In Stock"
 *   - Current_Quantity > 0 → "Low Stock"
 *   - Current_Quantity === 0 → "Out of Stock"
 *
 * Stock rules:
 *   - Quantity must be positive integer
 *   - stockOut cannot drive Current_Quantity below zero
 *   - Every adjustment creates a movement record
 */

/**
 * List all inventory items
 * Supports filtering by Category and Status
 */
export async function listInventory(
  filters?: {
    Category?: string;
    Status?: string;
  }
): Promise<InventoryItem[]> {
  return apiGet<InventoryItem[]>('inventory.list', filters);
}

/**
 * Create a new inventory item
 * Item_ID is server-generated
 * Status is derived server-side from quantities
 */
export async function createInventoryItem(
  payload: CreateInventoryItemPayload
): Promise<InventoryItem> {
  return apiPost<InventoryItem>('inventory.create', payload);
}

/**
 * Add stock to an inventory item
 * Creates a STOCK_IN movement record
 */
export async function stockIn(
  payload: StockAdjustmentPayload
): Promise<InventoryItem> {
  return apiPost<InventoryItem>('inventory.stockIn', payload);
}

/**
 * Remove stock from an inventory item
 * Creates a STOCK_OUT movement record
 * Cannot reduce quantity below zero
 */
export async function stockOut(
  payload: StockAdjustmentPayload
): Promise<InventoryItem> {
  return apiPost<InventoryItem>('inventory.stockOut', payload);
}

/**
 * Get movement history for an inventory item
 */
export async function getInventoryMovements(
  itemId: string
): Promise<InventoryMovement[]> {
  return apiGet<InventoryMovement[]>('inventory.movements', { Item_ID: itemId });
}

export default {
  listInventory,
  createInventoryItem,
  stockIn,
  stockOut,
  getInventoryMovements,
};
