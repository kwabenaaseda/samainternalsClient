import { apiGet, apiPost } from './client';
import type {
  Payment,
  CreatePaymentPayload,
  UpdatePaymentPayload,
} from '../types';

/**
 * School Fees API
 *
 * Backend contract (from SchoolFees.js):
 * - schoolFees.list: GET ?action=schoolFees.list
 *   Query params: Student_ID, Academic_Year, Term, Status (all optional)
 * - schoolFees.get: GET ?action=schoolFees.get&Payment_ID=<id>
 * - schoolFees.create: POST { action: "schoolFees.create", payload: {...} }
 * - schoolFees.update: POST { action: "schoolFees.update", payload: {...} }
 * - schoolFees.void: POST { action: "schoolFees.void", payload: { Payment_ID } }
 *
 * Payment_ID format: SF-XXX (server-generated)
 * Balance = Amount_Due - Amount_Paid (server-calculated)
 * Amount_Paid must not exceed Amount_Due
 * Student must exist and not be withdrawn
 *
 * Required fields for create:
 *   Student_ID, Academic_Year, Term, Amount_Due, Amount_Paid, Payment_Method, Payment_Date
 *
 * Valid Payment_Methods: Cash, Bank Transfer, Mobile Money, Other
 * Valid Statuses: Unpaid, Partial, Paid, Voided
 */

/**
 * List school fee payments
 * Supports filtering by Student_ID, Academic_Year, Term, Status
 */
export async function listSchoolFees(
  filters?: {
    Student_ID?: string;
    Academic_Year?: string;
    Term?: string;
    Status?: string;
  }
): Promise<Payment[]> {
  return apiGet<Payment[]>('schoolFees.list', filters);
}

/**
 * Get a single school fee payment by ID
 */
export async function getSchoolFee(paymentId: string): Promise<Payment> {
  return apiGet<Payment>('schoolFees.get', { Payment_ID: paymentId });
}

/**
 * Create a new school fee payment record
 * Used for recording payments
 */
export async function createSchoolFee(
  payload: CreatePaymentPayload
): Promise<Payment> {
  return apiPost<Payment>('schoolFees.create', payload);
}

/**
 * Update an existing school fee payment
 * Can modify Amount_Paid, Payment_Date, Payment_Method, Reference, Status, Notes
 * Balance is recalculated server-side
 */
export async function updateSchoolFee(
  payload: UpdatePaymentPayload
): Promise<Payment> {
  return apiPost<Payment>('schoolFees.update', payload);
}

/**
 * Void a school fee payment
 * Soft correction - sets Status='Voided', record preserved
 * Cannot void an already-voided payment
 */
export async function voidSchoolFee(paymentId: string): Promise<Payment> {
  return apiPost<Payment>('schoolFees.void', { Payment_ID: paymentId });
}

export default {
  listSchoolFees,
  getSchoolFee,
  createSchoolFee,
  updateSchoolFee,
  voidSchoolFee,
};
