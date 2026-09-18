// Inventory Types
// Based on Inventory.js schema

export type InventoryStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';
export type MovementType = 'STOCK_IN' | 'STOCK_OUT';

export interface InventoryItem {
  Item_ID: string;
  Item_Name: string;
  Category?: string;
  Unit?: string;
  Selling_Price: number;
  Current_Quantity: number;
  Minimum_Stock_Level: number;
  Status: InventoryStatus; // Server-derived
}

export interface InventoryMovement {
  Movement_ID: string;
  Item_ID: string;
  Movement_Type: MovementType;
  Quantity: number;
  Date: string;
  Reason?: string;
  Recorded_By?: string;
  Notes?: string;
}

export interface CreateInventoryItemPayload {
  Item_Name: string;
  Category?: string;
  Unit?: string;
  Selling_Price: number;
  Current_Quantity?: number;
  Minimum_Stock_Level?: number;
}

export interface StockAdjustmentPayload {
  Item_ID: string;
  Quantity: number;
  Reason?: string;
  Notes?: string;
}
