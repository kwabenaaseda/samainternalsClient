import { apiGet, apiPost } from './client';
import type {
  Payment,
  CreatePaymentPayload,
  UpdatePaymentPayload,
} from '../types';

/**
 * Feeding Fees API
 *
 * Backend contract (from FeedingFees.js):
 * - feedingFees.list: GET ?action=feedingFees.list
 *   Query params: Student_ID, Academic_Year, Term, Status (all optional)
 * - feedingFees.get: GET ?action=feedingFees.get&Payment_ID=<id>
 * - feedingFees.create: POST { action: "feedingFees.create", payload: {...} }
 * - feedingFees.update: POST { action: "feedingFees.update", payload: {...} }
 * - feedingFees.void: POST { action: "feedingFees.void", payload: { Payment_ID } }
 *
 * IDENTICAL contract to School Fees, except:
 * - Payment_ID format: FF-XXX
 * - Different sheet: Feeding_Fees
 *
 * This API reuses the same types and patterns as School Fees.
 * The PaymentForm/PaymentSummary components should be shared.
 */

/**
 * List feeding fee payments
 * Supports filtering by Student_ID, Academic_Year, Term, Status
 */
export async function listFeedingFees(
  filters?: {
    Student_ID?: string;
    Academic_Year?: string;
    Term?: string;
    Status?: string;
  }
): Promise<Payment[]> {
  return apiGet<Payment[]>('feedingFees.list', filters);
}

/**
 * Get a single feeding fee payment by ID
 */
export async function getFeedingFee(paymentId: string): Promise<Payment> {
  return apiGet<Payment>('feedingFees.get', { Payment_ID: paymentId });
}

/**
 * Create a new feeding fee payment record
 */
export async function createFeedingFee(
  payload: CreatePaymentPayload
): Promise<Payment> {
  return apiPost<Payment>('feedingFees.create', payload);
}

/**
 * Update an existing feeding fee payment
 */
export async function updateFeedingFee(
  payload: UpdatePaymentPayload
): Promise<Payment> {
  return apiPost<Payment>('feedingFees.update', payload);
}

/**
 * Void a feeding fee payment
 */
export async function voidFeedingFee(paymentId: string): Promise<Payment> {
  return apiPost<Payment>('feedingFees.void', { Payment_ID: paymentId });
}

export default {
  listFeedingFees,
  getFeedingFee,
  createFeedingFee,
  updateFeedingFee,
  voidFeedingFee,
};
