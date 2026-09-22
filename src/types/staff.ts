// Staff Types
// Based on Staff.js schema

export type StaffStatus = 'Active' | 'Inactive' | 'On Leave' | 'Terminated';

/**
 * Mirrors CONFIG.SALARY_FREQUENCY in Config.js, which is the allow-list
 * `assertOneOf_` validates Salary_Frequency against. Anything outside this union
 * is rejected by the backend with VALIDATION_ERROR.
 */
export type SalaryFrequency = 'Monthly' | 'Bi-weekly' | 'Weekly' | 'Annual';

export interface Staff {
  Staff_ID: string;
  First_Name: string;
  Last_Name: string;
  Gender?: string;
  Date_of_Birth?: string;
  Phone?: string;
  Email?: string;
  Address?: string;
  Position?: string;
  Department?: string;
  Employment_Date?: string;
  Employment_Status: StaffStatus;
  Salary_Amount?: number;
  Salary_Frequency?: SalaryFrequency;
  Last_Salary_Paid_Date?: string;
  Next_Salary_Due_Date?: string;
  Salary_Status?: string;
  Notes?: string;
}

export interface CreateStaffPayload {
  First_Name: string;
  Last_Name: string;
  Email: string;
  Position: string;
  Employment_Date: string;
  Gender?: string;
  Date_of_Birth?: string;
  Phone?: string;
  Address?: string;
  Department?: string;
  Salary_Amount?: number;
  Salary_Frequency?: SalaryFrequency;
  Next_Salary_Due_Date?: string;
  Notes?: string;
}

export interface UpdateStaffPayload {
  Staff_ID: string;
  First_Name?: string;
  Last_Name?: string;
  Gender?: string;
  Date_of_Birth?: string;
  Phone?: string;
  Email?: string;
  Address?: string;
  Position?: string;
  Department?: string;
  Employment_Date?: string;
  Employment_Status?: StaffStatus;
  Salary_Amount?: number;
  Salary_Frequency?: SalaryFrequency;
  Last_Salary_Paid_Date?: string;
  Next_Salary_Due_Date?: string;
  Salary_Status?: string;
  Notes?: string;
}
