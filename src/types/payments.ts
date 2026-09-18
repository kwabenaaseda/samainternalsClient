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
