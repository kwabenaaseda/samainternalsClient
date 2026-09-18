import { apiPost } from './client';
import type { DashboardSummary } from '../types';

/**
 * Dashboard API
 *
 * Backend contract (from Dashboard.js):
 * - dashboard.summary: POST { action: "dashboard.summary", payload: {} }
 *
 * Returns aggregate statistics across all modules in a single call.
 * Requires DASHBOARD.READ permission.
 *
 * NOTE: No date-range filtering in MVP1 - sums everything.
 *       That's a future refinement.
 */

/**
 * Get dashboard summary with all aggregate statistics
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiPost<DashboardSummary>('dashboard.summary', {});
}

export default {
  getDashboardSummary,
};
