import { apiGet, apiPost } from './client';
import type {
  StationeryTransaction,
  CreateStationeryPayload,
  FulfillStationeryPayload,
} from '../types';

/**
 * Stationery API
 *
 * Backend contract (from Stationery.js):
 * - stationery.list: GET ?action=stationery.list
 * - stationery.create: POST { action: "stationery.create", payload: {...} }
 * - stationery.fulfill: POST { action: "stationery.fulfill", payload: {...} }
 *
 * Transaction_ID format: ST-XXX (server-generated)
 * Fulfillment_Status: Pending, Partial, Fulfilled, Voided
 *
 * Fulfillment:
 * - Reduces inventory stock
 * - Requires both STATIONERY.FULFILL and INVENTORY.ADJUST permissions
 * - Creates inventory movement record
 */

/**
 * List all stationery transactions
 */
export async function listStationery(): Promise<StationeryTransaction[]> {
  return apiGet<StationeryTransaction[]>('stationery.list');
}

/**
 * Create a new stationery transaction
 * Required fields: Student_ID, Item_ID, Quantity_Purchased, Unit_Price,
 *                  Amount_Paid, Payment_Method, Payment_Date
 */
export async function createStationery(
  payload: CreateStationeryPayload
): Promise<StationeryTransaction> {
  return apiPost<StationeryTransaction>('stationery.create', payload);
}

/**
 * Fulfill a stationery transaction (partially or fully)
 * Reduces inventory and updates fulfillment status
 *
 * Backend contract: stationery.fulfill reads payload.Quantity_Given (NOT the
 * "Quantity_To_Give" name used by the Execution API adapter). The value is the
 * number of items physically issued to the student.
 */
export async function fulfillStationery(
  payload: FulfillStationeryPayload
): Promise<StationeryTransaction> {
  return apiPost<StationeryTransaction>('stationery.fulfill', payload);
}

export default {
  listStationery,
  createStationery,
  fulfillStationery,
};
