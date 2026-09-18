// Dashboard Types
// Based on Dashboard.js summary response

export interface RecentPayment {
  type: 'schoolFees' | 'feedingFees';
  Payment_ID: string;
  Student_ID: string;
  Amount_Paid: number;
  Payment_Date: string;
}

export interface DashboardSummary {
  activeStudents: number;
  activeStaff: number;
  schoolFeesCollected: number;
  feedingFeesCollected: number;
  lowStockItems: number;
  recentPayments: RecentPayment[];
}
