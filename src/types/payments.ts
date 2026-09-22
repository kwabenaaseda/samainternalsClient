// Payment Types (School Fees & Feeding Fees - identical shape)
// Based on SchoolFees.js and FeedingFees.js schemas

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Mobile Money' | 'Other';
export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid' | 'Voided';
export type Term = 'Term 1' | 'Term 2' | 'Term 3';

export interface Payment {
  Payment_ID: string;
  Student_ID: string;
  Academic_Year: string;
  Term: Term;
  Amount_Due: number;
  Amount_Paid: number;
  Balance: number; // Server-calculated, read-only
  Payment_Date: string;
  Payment_Method: PaymentMethod;
  Reference?: string;
  Status: PaymentStatus;
  Recorded_By?: string; // Server-set, read-only
  Notes?: string;
}

export interface CreatePaymentPayload {
  Student_ID: string;
  Academic_Year: string;
  Term: Term;
  Amount_Due: number;
  Amount_Paid: number;
  Payment_Method: PaymentMethod;
  Payment_Date: string;
  Reference?: string;
  Notes?: string;
}

export interface UpdatePaymentPayload {
  Payment_ID: string;
  Amount_Due?: number;
  Amount_Paid?: number;
  Payment_Date?: string;
  Payment_Method?: PaymentMethod;
  Reference?: string;
  Status?: PaymentStatus;
  Notes?: string;
}

/* ==========================================================================
 * Option 2 ledger contract — School_Fee_Payments (SchoolFeePayments.js)
 *
 * One School_Fees row is a fee ACCOUNT (obligation): Amount_Due is the Fee
 * Amount. One School_Fee_Payments row is a payment TRANSACTION: Amount is the
 * money actually received. Amount_Paid/Balance on the account are server-derived
 * aggregates over the non-voided transactions, never client-supplied.
 * ======================================================================== */

/** A payment transaction is either money received or a voided correction. */
export type FeePaymentStatus = 'Paid' | 'Voided';

/**
 * One School_Fee_Payments row = one money-received event.
 * Schema: Payment_ID, Fee_ID, Amount, Payment_Method, Payment_Date,
 *         Reference, Recorded_By, Status, Notes.
 */
export interface FeePayment {
  /** FFP-001, FFP-002, ... server-generated and immutable. */
  Payment_ID: string;
  /** References School_Fees.Payment_ID (the fee account). */
  Fee_ID: string;
  /** The money received — NOT the account's Amount_Due. */
  Amount: number;
  Payment_Method: PaymentMethod;
  Payment_Date: string;
  Reference?: string;
  /** Server-set from the authenticated user; never sent by the client. */
  Recorded_By?: string;
  Status: FeePaymentStatus;
  Notes?: string;
}

/**
 * `feePayments.create` payload.
 *
 * Required by SchoolFeePayments.js: Fee_ID, Amount, Payment_Method,
 * Payment_Date. The backend rejects Amount <= 0 and Amount > Outstanding.
 */
export interface CreateFeePaymentPayload {
  Fee_ID: string;
  Amount: number;
  Payment_Method: PaymentMethod;
  Payment_Date: string;
  Reference?: string;
  Notes?: string;
}

/**
 * The account totals the backend returns alongside a Fee_ID-filtered ledger
 * read. This is the authoritative post-payment balance source for the UI.
 */
export interface FeeAccountSummary {
  Fee_ID: string;
  Student_ID: string;
  Academic_Year: string;
  Term: string;
  /** The obligation (School_Fees.Amount_Due). */
  Fee_Amount: number;
  /** Sum of non-voided transactions. */
  Total_Paid: number;
  /** Fee_Amount - Total_Paid. */
  Outstanding: number;
  Status: PaymentStatus;
}

/** Data of `feePayments.list` when a Fee_ID is supplied. */
export interface FeePaymentLedger {
  payments: FeePayment[];
  account: FeeAccountSummary;
}

/**
 * The fee account record returned by `feePayments.create` / `feePayments.void`:
 * the School_Fees row plus the two aggregate aliases.
 */
export interface FeeAccountTotals extends Payment {
  Total_Paid: number;
  Outstanding: number;
}

/** Data of `feePayments.create` and `feePayments.void`. */
export interface FeePaymentMutationResult {
  payment: FeePayment;
  account: FeeAccountTotals;
}
