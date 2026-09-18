import { apiGet, apiPost } from './client';
import type {
  Staff,
  CreateStaffPayload,
  UpdateStaffPayload,
} from '../types';

/**
 * Staff API
 *
 * Backend contract (from Staff.js):
 * - staff.list: GET ?action=staff.list
 * - staff.get: GET ?action=staff.get&Staff_ID=<id>
 * - staff.create: POST { action: "staff.create", payload: {...} }
 * - staff.update: POST { action: "staff.update", payload: {...} }
 * - staff.deactivate: POST { action: "staff.deactivate", payload: { Staff_ID } }
 *
 * Required fields for create: First_Name, Last_Name, Email, Position, Employment_Date
 * Staff_ID is server-generated, never supplied by client
 */

/**
 * List all staff
 */
export async function listStaff(): Promise<Staff[]> {
  return apiGet<Staff[]>('staff.list');
}

/**
 * Get a single staff member by ID
 */
export async function getStaff(staffId: string): Promise<Staff> {
  return apiGet<Staff>('staff.get', { Staff_ID: staffId });
}

/**
 * Create a new staff member
 * Staff_ID is generated server-side
 */
export async function createStaff(
  payload: CreateStaffPayload
): Promise<Staff> {
  return apiPost<Staff>('staff.create', payload);
}

/**
 * Update an existing staff member
 * Staff_ID identifies the row but cannot be changed
 */
export async function updateStaff(
  payload: UpdateStaffPayload
): Promise<Staff> {
  return apiPost<Staff>('staff.update', payload);
}

/**
 * Soft-deactivate a staff member
 * Sets Employment_Status='Inactive'
 * Does NOT delete the record
 */
export async function deactivateStaff(
  staffId: string
): Promise<Staff> {
  return apiPost<Staff>('staff.deactivate', { Staff_ID: staffId });
}

export default {
  listStaff,
  getStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
};
