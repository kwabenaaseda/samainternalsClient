import { apiGet, apiPost } from './client';
import type {
  Student,
  CreateStudentPayload,
  UpdateStudentPayload,
} from '../types';

/**
 * Students API
 *
 * Backend contract (from Students.js):
 * - students.list: GET ?action=students.list - returns { students, count }
 * - students.get: GET ?action=students.get&Student_ID=<id>
 * - students.create: POST { action: "students.create", payload: {...} }
 * - students.update: POST { action: "students.update", payload: {...} }
 * - students.withdraw: POST { action: "students.withdraw", payload: { Student_ID } }
 *
 * Required fields for create: First_Name, Last_Name, Class, Admission_Date, Parent_Guardian
 * Student_ID is server-generated, never supplied by client
 */

/**
 * Raw payload of `students.list`.
 *
 * Students.js wraps the rows: success({ students: records, count }). The API
 * client returns the envelope's `data` verbatim, so the wrapper MUST be
 * unwrapped here -- typing this call as `Student[]` would hand callers an
 * object and any .filter()/.map() would throw at runtime.
 */
interface StudentListResult {
  students: Student[];
  count: number;
}

/**
 * List all students
 * No pagination in MVP1 - returns all records
 */
export async function listStudents(): Promise<Student[]> {
  const result = await apiGet<StudentListResult>('students.list');
  return Array.isArray(result?.students) ? result.students : [];
}

/**
 * Get a single student by ID
 */
export async function getStudent(
  studentId: string
): Promise<Student> {
  return apiGet<Student>('students.get', { Student_ID: studentId });
}

/**
 * Create a new student
 * Student_ID is generated server-side
 */
export async function createStudent(
  payload: CreateStudentPayload
): Promise<Student> {
  return apiPost<Student>('students.create', payload);
}

/**
 * Update an existing student
 * Student_ID identifies the row but cannot be changed
 */
export async function updateStudent(
  payload: UpdateStudentPayload
): Promise<Student> {
  return apiPost<Student>('students.update', payload);
}

/**
 * Soft-withdraw a student
 * Sets Status='Withdrawn' and Withdrawal_Date=today
 * Does NOT delete the record
 */
export async function withdrawStudent(
  studentId: string
): Promise<Student> {
  return apiPost<Student>('students.withdraw', { Student_ID: studentId });
}

export default {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  withdrawStudent,
};
