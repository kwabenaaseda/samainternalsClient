import { apiGet, apiPost } from './client';
import type {
  CreateFeePaymentPayload,
  FeePayment,
  FeePaymentLedger,
  FeePaymentMutationResult,
} from '../types';

/**
 * Fee Payments API — payment TRANSACTIONS against a school fee account.
 *
 * Backend contract (from SchoolFeePayments.js). No new endpoints are introduced
 * here; these three actions already exist in Config.js/ACTIONS.SCHOOL_FEES.PAYMENTS.
 *
 * - feePayments.list: GET ?action=feePayments.list[&Fee_ID=<id>]
 *     Fee_ID omitted -> FeePayment[] (the whole ledger)
 *     Fee_ID present -> { payments, account } where `account` carries the
 *                       server-derived Fee_Amount / Total_Paid / Outstanding /
 *                       Status for that account.
 * - feePayments.create: POST { action: "feePayments.create", payload: {...} }
 * - feePayments.void:   POST { action: "feePayments.void", payload: { Payment_ID } }
 *
 * Permissions (existing SCHOOL_FEES.* codes, enforced server-side):
 *   feePayments.list   -> SCHOOL_FEES.READ
 *   feePayments.create -> SCHOOL_FEES.CREATE
 *   feePayments.void   -> SCHOOL_FEES.VOID
 *
 * Server-owned rules the frontend must NOT re-implement:
 *   - Amount must be > 0 and <= the account's Outstanding (MVP1: no overpayment)
 *   - Total_Paid / Outstanding are aggregates over NON-VOIDED transactions
 *   - Payment_ID and Recorded_By are server-set
 *   - A payment against a Voided account is rejected (`voided-fee-account`)
 */

/**
 * List the payment transactions of ONE fee account, together with the
 * account's server-derived totals.
 *
 * @param feeId School_Fees.Payment_ID of the account (e.g. "SF-003").
 */
export async function listFeePaymentsForAccount(
  feeId: string
): Promise<FeePaymentLedger> {
  return apiGet<FeePaymentLedger>('feePayments.list', { Fee_ID: feeId });
}

/**
 * List every payment transaction in the ledger (no Fee_ID filter).
 * The backend answers this shape with a bare array.
 */
export async function listAllFeePayments(): Promise<FeePayment[]> {
  const result = await apiGet<FeePayment[] | null>('feePayments.list');
  return Array.isArray(result) ? result : [];
}

/**
 * Record money received against an EXISTING fee account.
 *
 * `payload.Amount` is the amount actually received — never the account's
 * Amount_Due. On success the backend returns the new transaction plus the
 * recalculated account totals.
 */
export async function createFeePayment(
  payload: CreateFeePaymentPayload
): Promise<FeePaymentMutationResult> {
  return apiPost<FeePaymentMutationResult>('feePayments.create', payload);
}

/**
 * Void a payment transaction (soft correction).
 * The row is preserved with Status='Voided' and stops counting toward Total
 * Paid. This voids ONE transaction, not the whole fee account.
 */
export async function voidFeePayment(
  paymentId: string
): Promise<FeePaymentMutationResult> {
  return apiPost<FeePaymentMutationResult>('feePayments.void', {
    Payment_ID: paymentId,
  });
}

export default {
  listFeePaymentsForAccount,
  listAllFeePayments,
  createFeePayment,
  voidFeePayment,
};
