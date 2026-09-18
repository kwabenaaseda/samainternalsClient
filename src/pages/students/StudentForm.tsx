/**
 * StudentForm
 *
 * The single editable form for a student record, shared by Create and Edit.
 * Only fields the backend actually accepts are rendered:
 *
 *   CreateStudentPayload / UpdateStudentPayload (src/types/students.ts)
 *
 * Deliberately EXCLUDED:
 *   - Student_ID  -> server-generated (generateId_('STU')), immutable, and
 *                    handleStudentsCreate_ rejects any client-supplied value.
 *   - Status      -> set to Active on create and changed only through the
 *                    dedicated `students.withdraw` operation, so the UI has
 *                    exactly one status-transition path.
 *   - Withdrawal_Date -> written by `students.withdraw` only.
 *
 * Client validation mirrors Students.js REQUIRED_STUDENT_FIELDS. The backend
 * remains the authority; its VALIDATION_ERROR is surfaced via `fieldErrors`.
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
  FormTextarea,
} from '../../components/ui';
import type { Student } from '../../types';

export interface StudentFormValues {
  First_Name: string;
  Last_Name: string;
  Gender: string;
  Date_of_Birth: string;
  Class: string;
  Admission_Date: string;
  Parent_Guardian: string;
  Guardian_Phone: string;
  Guardian_Email: string;
  Emergency_Contact_1_Name: string;
  Emergency_Contact_1_Phone: string;
  Emergency_Contact_1_Relationship: string;
  Emergency_Contact_2_Name: string;
  Emergency_Contact_2_Phone: string;
  Emergency_Contact_2_Relationship: string;
  Allergies: string;
  Illnesses_Medical_Conditions: string;
  Physical_Defects_Special_Conditions: string;
  Notes: string;
}

export type StudentFormErrors = Partial<Record<keyof StudentFormValues, string>>;

/** Fields Students.js refuses to create a student without. */
const REQUIRED_FIELDS: (keyof StudentFormValues)[] = [
  'First_Name',
  'Last_Name',
  'Class',
  'Admission_Date',
  'Parent_Guardian',
];

/** Human labels used in validation messages. */
const FIELD_LABELS: Record<keyof StudentFormValues, string> = {
  First_Name: 'First name',
  Last_Name: 'Last name',
  Gender: 'Gender',
  Date_of_Birth: 'Date of birth',
  Class: 'Class',
  Admission_Date: 'Admission date',
  Parent_Guardian: 'Parent / guardian',
  Guardian_Phone: 'Guardian phone',
  Guardian_Email: 'Guardian email',
  Emergency_Contact_1_Name: 'Emergency contact 1 name',
  Emergency_Contact_1_Phone: 'Emergency contact 1 phone',
  Emergency_Contact_1_Relationship: 'Emergency contact 1 relationship',
  Emergency_Contact_2_Name: 'Emergency contact 2 name',
  Emergency_Contact_2_Phone: 'Emergency contact 2 phone',
  Emergency_Contact_2_Relationship: 'Emergency contact 2 relationship',
  Allergies: 'Allergies',
  Illnesses_Medical_Conditions: 'Illnesses / medical conditions',
  Physical_Defects_Special_Conditions: 'Physical defects / special conditions',
  Notes: 'Notes',
};

export const EMPTY_STUDENT_FORM: StudentFormValues = {
  First_Name: '',
  Last_Name: '',
  Gender: '',
  Date_of_Birth: '',
  Class: '',
  Admission_Date: '',
  Parent_Guardian: '',
  Guardian_Phone: '',
  Guardian_Email: '',
  Emergency_Contact_1_Name: '',
  Emergency_Contact_1_Phone: '',
  Emergency_Contact_1_Relationship: '',
  Emergency_Contact_2_Name: '',
  Emergency_Contact_2_Phone: '',
  Emergency_Contact_2_Relationship: '',
  Allergies: '',
  Illnesses_Medical_Conditions: '',
  Physical_Defects_Special_Conditions: '',
  Notes: '',
};

/** Convert a stored student into form values (missing columns become ''). */
export function studentToFormValues(student: Student): StudentFormValues {
  const values = { ...EMPTY_STUDENT_FORM };
  (Object.keys(values) as (keyof StudentFormValues)[]).forEach((key) => {
    const raw = (student as unknown as Record<string, unknown>)[key];
    values[key] = raw === undefined || raw === null ? '' : String(raw);
  });
  return values;
}

/**
 * Convert form values into a create/update payload.
 *
 * Required fields always travel even when blank, so the backend reports them
 * rather than the client silently omitting them. Blank optional fields are
 * dropped, so an untouched field is never written as a meaningless empty string.
 */
export function formValuesToPayload(values: StudentFormValues): Record<string, string> {
  const payload: Record<string, string> = {};
  (Object.keys(values) as (keyof StudentFormValues)[]).forEach((key) => {
    const trimmed = values[key].trim();
    if (trimmed !== '' || REQUIRED_FIELDS.includes(key)) {
      payload[key] = trimmed;
    }
  });
  return payload;
}

/** Lightweight email shape check; the backend re-validates via assertEmail_. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

interface StudentFormProps {
  initialValues: StudentFormValues;
  submitLabel: string;
  submitting: boolean;
  /** Error spanning the whole submission (e.g. NOT_FOUND, SERVER_ERROR). */
  formError?: string | null;
  /** Field-level errors, from the backend or a previous attempt. */
  fieldErrors?: StudentFormErrors;
  onSubmit: (values: StudentFormValues) => void;
  onCancel: () => void;
}

export function StudentForm({
  initialValues,
  submitLabel,
  submitting,
  formError = null,
  fieldErrors = {},
  onSubmit,
  onCancel,
}: StudentFormProps) {
  const [values, setValues] = useState<StudentFormValues>(initialValues);
  const [localErrors, setLocalErrors] = useState<StudentFormErrors>({});

  const setField = (field: keyof StudentFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Clear a stale error as soon as the user edits the field.
    setLocalErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const errors: StudentFormErrors = { ...localErrors, ...fieldErrors };

  const validate = (): boolean => {
    const found: StudentFormErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (values[field].trim() === '') {
        found[field] = FIELD_LABELS[field] + ' is required';
      }
    });

    const email = values.Guardian_Email.trim();
    if (email !== '' && !looksLikeEmail(email)) {
      found.Guardian_Email = 'Enter a valid email address';
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
        <CardHeader title="Student details" />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            hint="Recorded exactly as written on the admission form"
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
            label="Class"
            name="Class"
            value={values.Class}
            onChange={(e) => setField('Class', e.target.value)}
            error={errors.Class}
            hint="e.g. KG, 2A"
            autoComplete="off"
          />
          <DateInput
            label="Admission date"
            name="Admission_Date"
            value={values.Admission_Date}
            onChange={(e) => setField('Admission_Date', e.target.value)}
            error={errors.Admission_Date}
          />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Parent / guardian" />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Parent / guardian name"
            name="Parent_Guardian"
            value={values.Parent_Guardian}
            onChange={(e) => setField('Parent_Guardian', e.target.value)}
            error={errors.Parent_Guardian}
            autoComplete="off"
          />
          <FormInput
            label="Guardian phone"
            name="Guardian_Phone"
            value={values.Guardian_Phone}
            onChange={(e) => setField('Guardian_Phone', e.target.value)}
            error={errors.Guardian_Phone}
            autoComplete="off"
          />
          <FormInput
            label="Guardian email"
            name="Guardian_Email"
            type="email"
            value={values.Guardian_Email}
            onChange={(e) => setField('Guardian_Email', e.target.value)}
            error={errors.Guardian_Email}
            autoComplete="off"
          />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Emergency contacts" />
        <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Contact 1 name"
            name="Emergency_Contact_1_Name"
            value={values.Emergency_Contact_1_Name}
            onChange={(e) => setField('Emergency_Contact_1_Name', e.target.value)}
            autoComplete="off"
          />
          <FormInput
            label="Contact 1 phone"
            name="Emergency_Contact_1_Phone"
            value={values.Emergency_Contact_1_Phone}
            onChange={(e) => setField('Emergency_Contact_1_Phone', e.target.value)}
            autoComplete="off"
          />
          <FormInput
            label="Contact 1 relationship"
            name="Emergency_Contact_1_Relationship"
            value={values.Emergency_Contact_1_Relationship}
            onChange={(e) => setField('Emergency_Contact_1_Relationship', e.target.value)}
            autoComplete="off"
          />
          <FormInput
            label="Contact 2 name"
            name="Emergency_Contact_2_Name"
            value={values.Emergency_Contact_2_Name}
            onChange={(e) => setField('Emergency_Contact_2_Name', e.target.value)}
            autoComplete="off"
          />
          <FormInput
            label="Contact 2 phone"
            name="Emergency_Contact_2_Phone"
            value={values.Emergency_Contact_2_Phone}
            onChange={(e) => setField('Emergency_Contact_2_Phone', e.target.value)}
            autoComplete="off"
          />
          <FormInput
            label="Contact 2 relationship"
            name="Emergency_Contact_2_Relationship"
            value={values.Emergency_Contact_2_Relationship}
            onChange={(e) => setField('Emergency_Contact_2_Relationship', e.target.value)}
            autoComplete="off"
          />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Medical and notes" />
        <CardBody className="space-y-4">
          <FormTextarea
            label="Allergies"
            name="Allergies"
            value={values.Allergies}
            onChange={(e) => setField('Allergies', e.target.value)}
          />
          <FormTextarea
            label="Illnesses / medical conditions"
            name="Illnesses_Medical_Conditions"
            value={values.Illnesses_Medical_Conditions}
            onChange={(e) => setField('Illnesses_Medical_Conditions', e.target.value)}
          />
          <FormTextarea
            label="Physical defects / special conditions"
            name="Physical_Defects_Special_Conditions"
            value={values.Physical_Defects_Special_Conditions}
            onChange={(e) => setField('Physical_Defects_Special_Conditions', e.target.value)}
          />
          <FormTextarea
            label="Notes"
            name="Notes"
            value={values.Notes}
            onChange={(e) => setField('Notes', e.target.value)}
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

export default StudentForm;
