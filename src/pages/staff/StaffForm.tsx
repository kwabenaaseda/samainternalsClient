/**
 * StaffForm
 *
 * The single editable form for a staff record, shared by Create and Edit.
 * Only fields the backend actually accepts are rendered:
 *
 *   CreateStaffPayload / UpdateStaffPayload (src/types/staff.ts)
 *   STAFF_COLUMNS (Staff.js)
 *
 * Deliberately EXCLUDED:
 *   - Staff_ID            -> server-generated (generateId_('STF')), immutable.
 *                            handleStaffCreate_ rejects any client-supplied
 *                            value; handleStaffUpdate_ deletes it from the patch.
 *   - Employment_Status   -> 'Active' on create (backend default) and changed
 *                            only through `staff.deactivate`, so the UI has
 *                            exactly one status-transition path.
 *   - Last_Salary_Paid_Date / Salary_Status -> payroll-managed columns, not part
 *                            of the create contract.
 *
 * Client validation mirrors Staff.js REQUIRED_STAFF_FIELDS. The backend remains
 * the authority; its VALIDATION_ERROR is surfaced via `fieldErrors`.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DateInput,
  FormInput,
  FormSelect,
  FormTextarea,
} from '../../components/ui';
import { getMissingFields, getThrownErrorMessage } from '../../api/response';
import type { ApiErrorLike } from '../../api/response';
import type {
  CreateStaffPayload,
  SalaryFrequency,
  Staff,
  UpdateStaffPayload,
} from '../../types';

export interface StaffFormValues {
  First_Name: string;
  Last_Name: string;
  Gender: string;
  Date_of_Birth: string;
  Phone: string;
  Email: string;
  Address: string;
  Position: string;
  Department: string;
  Employment_Date: string;
  Salary_Amount: string;
  Salary_Frequency: string;
  Next_Salary_Due_Date: string;
  Notes: string;
}

export type StaffFormErrors = Partial<Record<keyof StaffFormValues, string>>;

/** Fields Staff.js refuses to create a staff member without. */
const REQUIRED_FIELDS: (keyof StaffFormValues)[] = [
  'First_Name',
  'Last_Name',
  'Email',
  'Position',
  'Employment_Date',
];

/** Human labels used in validation messages. */
const FIELD_LABELS: Record<keyof StaffFormValues, string> = {
  First_Name: 'First name',
  Last_Name: 'Last name',
  Gender: 'Gender',
  Date_of_Birth: 'Date of birth',
  Phone: 'Phone',
  Email: 'Email',
  Address: 'Address',
  Position: 'Position',
  Department: 'Department',
  Employment_Date: 'Employment date',
  Salary_Amount: 'Salary amount',
  Salary_Frequency: 'Salary frequency',
  Next_Salary_Due_Date: 'Next salary due date',
  Notes: 'Notes',
};

/** Date-typed fields, which travel to the backend as yyyy-MM-dd and need
 *  normalising when read back out of the sheet. */
const DATE_FIELDS: (keyof StaffFormValues)[] = [
  'Date_of_Birth',
  'Employment_Date',
  'Next_Salary_Due_Date',
];

/** CONFIG.VALUES.SALARY_FREQUENCY (Config.js) - the allow-list the backend
 *  validates Salary_Frequency against. */
export const SALARY_FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Bi-weekly', label: 'Bi-weekly' },
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Annual', label: 'Annual' },
];

/** CONFIG.STAFF_STATUS (Config.js) - used by the list page's status filter. */
export const STAFF_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'On Leave', label: 'On Leave' },
  { value: 'Terminated', label: 'Terminated' },
];

const SALARY_FREQUENCIES: string[] = ['Monthly', 'Bi-weekly', 'Weekly', 'Annual'];

/** Narrow a form string to the backend's Salary_Frequency allow-list. */
function toSalaryFrequency(value: string): SalaryFrequency | undefined {
  return SALARY_FREQUENCIES.includes(value) ? (value as SalaryFrequency) : undefined;
}

export const EMPTY_STAFF_FORM: StaffFormValues = {
  First_Name: '',
  Last_Name: '',
  Gender: '',
  Date_of_Birth: '',
  Phone: '',
  Email: '',
  Address: '',
  Position: '',
  Department: '',
  Employment_Date: '',
  Salary_Amount: '',
  Salary_Frequency: '',
  Next_Salary_Due_Date: '',
  Notes: '',
};

function isStaffField(field: string): field is keyof StaffFormValues {
  return Object.prototype.hasOwnProperty.call(FIELD_LABELS, field);
}

/** Lightweight email shape check; the backend re-validates via assertEmail_. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatParts(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Normalise a date cell for `<input type="date">`.
 *
 * rowToObject_ returns cells verbatim, so a date-formatted column arrives as a
 * Date (serialised to an ISO timestamp over the wire) rather than yyyy-MM-dd.
 * Stringifying that directly would hand the date input an unparseable value,
 * so dates are re-formatted here before they reach the form.
 */
function toDateInputValue(value: unknown): string {
  if (value === undefined || value === null) return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = String(value).trim();
  // Already yyyy-MM-dd, or an ISO timestamp: keep the leading date part so a
  // UTC-midnight value can never shift a day across timezones.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return text;
}

/** One stored column exactly as it should appear in the form. */
function recordFormValue(staff: Staff, key: keyof StaffFormValues): string {
  const raw = (staff as unknown as Record<string, unknown>)[key];
  if (DATE_FIELDS.includes(key)) return toDateInputValue(raw);
  if (raw === undefined || raw === null) return '';
  return String(raw);
}

/** Convert a stored staff record into form values (missing columns become ''). */
export function staffToFormValues(staff: Staff): StaffFormValues {
  const values = { ...EMPTY_STAFF_FORM };
  (Object.keys(values) as (keyof StaffFormValues)[]).forEach((key) => {
    values[key] = recordFormValue(staff, key);
  });
  return values;
}

/**
 * Convert form values into a `staff.create` payload.
 *
 * Required fields always travel even when blank, so the backend reports them
 * rather than the client silently omitting them. Blank optional fields are
 * dropped, so an untouched column is never written as a meaningless empty
 * string. Staff_ID is never sent: the backend generates it and rejects a
 * client-supplied value.
 */
export function formValuesToCreatePayload(values: StaffFormValues): CreateStaffPayload {
  const payload: CreateStaffPayload = {
    First_Name: values.First_Name.trim(),
    Last_Name: values.Last_Name.trim(),
    Email: values.Email.trim(),
    Position: values.Position.trim(),
    Employment_Date: values.Employment_Date.trim(),
  };

  const gender = values.Gender.trim();
  if (gender !== '') payload.Gender = gender;

  const dateOfBirth = values.Date_of_Birth.trim();
  if (dateOfBirth !== '') payload.Date_of_Birth = dateOfBirth;

  const phone = values.Phone.trim();
  if (phone !== '') payload.Phone = phone;

  const address = values.Address.trim();
  if (address !== '') payload.Address = address;

  const department = values.Department.trim();
  if (department !== '') payload.Department = department;

  const salary = values.Salary_Amount.trim();
  if (salary !== '' && Number.isFinite(Number(salary))) {
    payload.Salary_Amount = Number(salary);
  }

  const frequency = toSalaryFrequency(values.Salary_Frequency.trim());
  if (frequency !== undefined) payload.Salary_Frequency = frequency;

  const nextDue = values.Next_Salary_Due_Date.trim();
  if (nextDue !== '') payload.Next_Salary_Due_Date = nextDue;

  const notes = values.Notes.trim();
  if (notes !== '') payload.Notes = notes;

  return payload;
}


/**
 * Convert form values into a `staff.update` patch.
 *
 * handleStaffUpdate_ merges the supplied keys over the stored row (it reads the
 * row, applies the patch and writes the merge back), so ONLY the fields the user
 * actually changed are sent: an untouched column is never rewritten, and a
 * field the user deliberately blanked is sent as '' so it does clear.
 *
 * Staff_ID always travels because it identifies the row; the backend deletes it
 * from the patch before writing, so it can never be changed.
 */
export function buildUpdatePayload(
  values: StaffFormValues,
  staff: Staff
): UpdateStaffPayload {
  const payload: UpdateStaffPayload = { Staff_ID: staff.Staff_ID };

  /** The new value, or undefined when the field is unchanged. */
  const changed = (key: keyof StaffFormValues): string | undefined => {
    const next = values[key].trim();
    return next === recordFormValue(staff, key).trim() ? undefined : next;
  };

  const firstName = changed('First_Name');
  if (firstName !== undefined) payload.First_Name = firstName;

  const lastName = changed('Last_Name');
  if (lastName !== undefined) payload.Last_Name = lastName;

  const gender = changed('Gender');
  if (gender !== undefined) payload.Gender = gender;

  const dateOfBirth = changed('Date_of_Birth');
  if (dateOfBirth !== undefined) payload.Date_of_Birth = dateOfBirth;

  const phone = changed('Phone');
  if (phone !== undefined) payload.Phone = phone;

  const email = changed('Email');
  if (email !== undefined) payload.Email = email;

  const address = changed('Address');
  if (address !== undefined) payload.Address = address;

  const position = changed('Position');
  if (position !== undefined) payload.Position = position;

  const department = changed('Department');
  if (department !== undefined) payload.Department = department;

  const employmentDate = changed('Employment_Date');
  if (employmentDate !== undefined) payload.Employment_Date = employmentDate;

  const nextSalaryDue = changed('Next_Salary_Due_Date');
  if (nextSalaryDue !== undefined) payload.Next_Salary_Due_Date = nextSalaryDue;

  const notes = changed('Notes');
  if (notes !== undefined) payload.Notes = notes;

  const salary = changed('Salary_Amount');
  if (salary !== undefined) {
    // Salary_Amount is the one payload field whose cleared state is '' rather
    // than a number. Staff.js skips a blank Salary_Amount in
    // normalizeStaffRecord_ and writes the blank cell through, which is how a
    // removed salary is expressed in the sheet.
    (payload as unknown as Record<string, unknown>).Salary_Amount =
      salary === '' ? '' : Number(salary);
  }

  const frequency = changed('Salary_Frequency');
  if (frequency !== undefined) {
    const allowed = toSalaryFrequency(frequency);
    if (allowed !== undefined) payload.Salary_Frequency = allowed;
  }

  return payload;
}

export interface StaffFormState {
  fieldErrors: StaffFormErrors;
  formError: string;
}

/**
 * Map a thrown backend error onto the form's error slots.
 *
 * A VALIDATION_ERROR's details carry either `missingFields` (assertRequired_) or
 * `field` (assertEmail_ / assertOneOf_ / normalizeStaffRecord_), both keyed by
 * sheet column name - which matches StaffFormValues exactly. Anything else
 * (NOT_FOUND, FORBIDDEN, CONFLICT, SERVER_ERROR) has no field to attach to, so
 * it becomes the form-level message instead.
 */
export function staffErrorToFormState(error: unknown, fallback: string): StaffFormState {
  const apiError = (error ?? {}) as ApiErrorLike;
  const fieldErrors: StaffFormErrors = {};

  getMissingFields(error).forEach((field) => {
    if (isStaffField(field)) fieldErrors[field] = FIELD_LABELS[field] + ' is required';
  });

  const details = (apiError.details ?? {}) as { field?: unknown };
  const field = typeof details.field === 'string' ? details.field : '';
  if (field !== '' && isStaffField(field)) {
    fieldErrors[field] = getThrownErrorMessage(error, fallback);
  }

  return {
    fieldErrors,
    formError:
      Object.keys(fieldErrors).length > 0 ? '' : getThrownErrorMessage(error, fallback),
  };
}

interface StaffFormProps {
  initialValues: StaffFormValues;
  submitLabel: string;
  submitting: boolean;
  /** Error spanning the whole submission (e.g. NOT_FOUND, SERVER_ERROR). */
  formError?: string | null;
  /** Field-level errors, from the backend or a previous attempt. */
  fieldErrors?: StaffFormErrors;
  /** The immutable Staff_ID, rendered read-only. It is never edited: the
   *  backend generates it and deletes it from any update patch. */
  staffId?: string;
  onSubmit: (values: StaffFormValues) => void;
  onCancel: () => void;
}

export function StaffForm({
  initialValues,
  submitLabel,
  submitting,
  formError = null,
  fieldErrors = {},
  staffId,
  onSubmit,
  onCancel,
}: StaffFormProps) {
  const [values, setValues] = useState<StaffFormValues>(initialValues);
  const [localErrors, setLocalErrors] = useState<StaffFormErrors>({});

  const setField = (field: keyof StaffFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a stale error as soon as the user edits the field.
    setLocalErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const errors: StaffFormErrors = { ...localErrors, ...fieldErrors };

  const validate = (): boolean => {
    const found: StaffFormErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (values[field].trim() === '') {
        found[field] = FIELD_LABELS[field] + ' is required';
      }
    });

    const email = values.Email.trim();
    if (email !== '' && !looksLikeEmail(email)) {
      found.Email = 'Enter a valid email address';
    }

    const salary = values.Salary_Amount.trim();
    if (salary !== '') {
      const amount = Number(salary);
      if (!Number.isFinite(amount) || amount < 0) {
        found.Salary_Amount = 'Salary amount must be a non-negative number';
      }
    }

    setLocalErrors(found);
    return Object.keys(found).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!validate()) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {formError}
        </div>
      )}

      <Card padding="none">
        <CardHeader title="Personal details" />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staffId !== undefined && staffId !== '' && (
            <div className="md:col-span-2">
              <FormInput
                label="Staff ID"
                name="Staff_ID"
                value={staffId}
                readOnly
                hint="Generated by the system and cannot be changed."
              />
            </div>
          )}
          <FormInput
            label="First name"
            name="First_Name"
            value={values.First_Name}
            onChange={(e) => setField('First_Name', e.target.value)}
            error={errors.First_Name}
            autoComplete="off"
          />
          <FormInput
            label="Last name"
            name="Last_Name"
            value={values.Last_Name}
            onChange={(e) => setField('Last_Name', e.target.value)}
            error={errors.Last_Name}
            autoComplete="off"
          />
          <FormInput
            label="Gender"
            name="Gender"
            value={values.Gender}
            onChange={(e) => setField('Gender', e.target.value)}
            error={errors.Gender}
            hint="Recorded exactly as written on the staff form"
            autoComplete="off"
          />
          <DateInput
            label="Date of birth"
            name="Date_of_Birth"
            value={values.Date_of_Birth}
            onChange={(e) => setField('Date_of_Birth', e.target.value)}
            error={errors.Date_of_Birth}
          />
          <FormInput
            label="Phone"
            name="Phone"
            value={values.Phone}
            onChange={(e) => setField('Phone', e.target.value)}
            error={errors.Phone}
            autoComplete="off"
          />
          <FormInput
            label="Email"
            name="Email"
            type="email"
            value={values.Email}
            onChange={(e) => setField('Email', e.target.value)}
            error={errors.Email}
            autoComplete="off"
          />
          <div className="md:col-span-2">
            <FormInput
              label="Address"
              name="Address"
              value={values.Address}
              onChange={(e) => setField('Address', e.target.value)}
              error={errors.Address}
              autoComplete="off"
            />
          </div>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Employment details" />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Position"
            name="Position"
            value={values.Position}
            onChange={(e) => setField('Position', e.target.value)}
            error={errors.Position}
            autoComplete="off"
          />
          <FormInput
            label="Department"
            name="Department"
            value={values.Department}
            onChange={(e) => setField('Department', e.target.value)}
            error={errors.Department}
            autoComplete="off"
          />
          <DateInput
            label="Employment date"
            name="Employment_Date"
            value={values.Employment_Date}
            onChange={(e) => setField('Employment_Date', e.target.value)}
            error={errors.Employment_Date}
          />
          <FormInput
            label="Employment status"
            name="Employment_Status"
            value="Set by the system"
            readOnly
            hint="New staff start as Active. Use Deactivate to end employment."
          />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Salary" />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Salary amount"
            name="Salary_Amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={values.Salary_Amount}
            onChange={(e) => setField('Salary_Amount', e.target.value)}
            error={errors.Salary_Amount}
            hint="Amount in GHS. Leave blank when no salary is recorded."
          />
          <FormSelect
            label="Salary frequency"
            name="Salary_Frequency"
            value={values.Salary_Frequency}
            onChange={(e) => setField('Salary_Frequency', e.target.value)}
            options={SALARY_FREQUENCY_OPTIONS}
            error={errors.Salary_Frequency}
          />
          <DateInput
            label="Next salary due date"
            name="Next_Salary_Due_Date"
            value={values.Next_Salary_Due_Date}
            onChange={(e) => setField('Next_Salary_Due_Date', e.target.value)}
            error={errors.Next_Salary_Due_Date}
            hint="Payroll scheduling only. Last paid date and salary status are payroll-managed."
          />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Additional notes" />
        <CardBody>
          <FormTextarea
            label="Notes"
            name="Notes"
            value={values.Notes}
            onChange={(e) => setField('Notes', e.target.value)}
            error={errors.Notes}
          />
        </CardBody>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;
