export { default as apiClient, apiRequest, apiGet, apiPost } from './client';
export {
  default as authApi,
  authMe,
  authCheck,
  authCheckMultiple,
  classifyAuthFailure,
  resolveAuth,
} from './auth';
export { default as studentsApi, listStudents, getStudent, createStudent, updateStudent, withdrawStudent } from './students';
export { default as staffApi, listStaff, getStaff, createStaff, updateStaff, deactivateStaff } from './staff';
export { default as schoolFeesApi, listSchoolFees, getSchoolFee, createSchoolFee, updateSchoolFee, voidSchoolFee } from './schoolFees';
export {
  default as feePaymentsApi,
  listFeePaymentsForAccount,
  listAllFeePayments,
  createFeePayment,
  voidFeePayment,
} from './feePayments';
export { default as feedingFeesApi, listFeedingFees, getFeedingFee, createFeedingFee, updateFeedingFee, voidFeedingFee } from './feedingFees';
export { default as stationeryApi, listStationery, createStationery, fulfillStationery } from './stationery';
export { default as inventoryApi, listInventory, createInventoryItem, stockIn, stockOut, getInventoryMovements } from './inventory';
export { default as dashboardApi, getDashboardSummary } from './dashboard';
export * from './config';
export * from './response';

