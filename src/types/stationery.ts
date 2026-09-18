// Stationery Types
// Based on Stationery.js schema

export type FulfillmentStatus = 'Pending' | 'Partial' | 'Fulfilled' | 'Voided';

export interface StationeryTransaction {
  Transaction_ID: string;
  Student_ID: string;
  Item_ID: string;
  Quantity_Purchased: number;
  Unit_Price: number;
  Total: number; // Server-calculated
  Amount_Paid: number;
  Balance: number; // Server-calculated
  Payment_Date: string;
  Payment_Method: import('./payments').PaymentMethod;
  Reference?: string;
  Fulfillment_Status: FulfillmentStatus;
  Quantity_Given: number;
  Quantity_Remaining: number;
  Given_By?: string;
  Given_Date?: string;
  Recorded_By?: string;
  Notes?: string;
}

export interface CreateStationeryPayload {
  Student_ID: string;
  Item_ID: string;
  Quantity_Purchased: number;
  Unit_Price: number;
  Amount_Paid: number;
  Payment_Method: import('./payments').PaymentMethod;
  Payment_Date: string;
  Reference?: string;
  Notes?: string;
}

export interface FulfillStationeryPayload {
  Transaction_ID: string;
  Quantity_To_Give: number;
}
