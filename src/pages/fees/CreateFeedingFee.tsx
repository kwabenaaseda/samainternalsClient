/**
 * CreateFeedingFee
 *
 * The "Record Payment" flow for a school fee, driven entirely by backend actions
 * the contract already exposes — no new endpoints:
 *
 *   students.list     → pick the student  (reuse the student-search pattern)
 *   feedingFees.list   → view the student's CURRENT balance (server-calculated)
 *   feedingFees.create → record the payment
 *
 * Money rules (FeedingFees.js) the frontend obeys without overriding:
 *  - Balance = Amount_Due - Amount_Paid  (always the backend's value)
 *  - Amount_Paid must not exceed Amount_Due (backend enforces; mirrored client-side)
 *  - Status is derived by the backend (Unpaid | Partial | Paid | Voided)
 * The student's outstanding balance shown here is a SUM of the backend's own
 * per-record Balance figures. The form never computes a balance of its own.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFeedingFee, listFeedingFees } from '../../api/feedingFees';
import { listStudents } from '../../api/students';
import {
  getMissingFields,
  getThrownErrorCode,
  getThrownErrorMessage,
} from '../../api/response';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CurrencyInput,
  DateInput,
  EmptyState,
  ErrorState,
  FormInput,
  FormSelect,
  FormTextarea,
  LoadingState,
  SearchInput,
  StatCard,
  StatusBadge,
  getStatusVariant,
} from '../../components/ui';
import { useToast } from '../../contexts';
import { usePermissions } from '../../hooks';
import type { Payment, PaymentMethod, PermissionCode, Student, Term } from '../../types';

const PAGE_PERMISSIONS: PermissionCode[] = [
  'FEEDING_FEES.CREATE',
  'FEEDING_FEES.READ',
  'STUDENTS.READ',
];

const TERM_OPTIONS: { value: string; label: string }[] = [
  { value: 'Term 1', label: 'Term 1' },
  { value: 'Term 2', label: 'Term 2' },
  { value: 'Term 3', label: 'Term 3' },
];

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Mobile Money', label: 'Mobile Money' },
  { value: 'Other', label: 'Other' },
];

const FIELD_LABELS: Record<string, string> = {
  Academic_Year: 'Academic year',
  Term: 'Term',
  Amount_Due: 'Amount due',
  Amount_Paid: 'Amount paid',
  Payment_Method: 'Payment method',
  Payment_Date: 'Payment date',
  Reference: 'Reference',
  Notes: 'Notes',
};

/** Today's date as a YYYY-MM-DD string for the date picker default. */
const todayISO = new Date().toISOString().split('T')[0];

/** Currency formatting, matching Dashboard's GHS convention. */
function formatAmount(value: number): string {
  const n = Number(value) || 0;
  return `GHS ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface FieldErrorInfo {
  field?: string;
  message: string;
}

/** Pulls a field name out of a backend VALIDATION_ERROR's `details`, if present. */
function extractFieldError(error: unknown): FieldErrorInfo {
  const apiError = (error ?? {}) as { message?: unknown; details?: { field?: unknown } };
  const field =
    apiError.details && typeof apiError.details.field === 'string'
      ? apiError.details.field
      : undefined;
  return {
    field,
    message: typeof apiError.message === 'string' ? apiError.message : '',
  };
}

export function CreateFeedingFee() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canCreate = permissions.get('FEEDING_FEES.CREATE') === true;

  // --- Step 1: pick a student ---
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // --- Step 2: show that student's current balance + history ---
  const [feeRecords, setFeeRecords] = useState<Payment[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // --- The payment form ---
  const [form, setForm] = useState({
    Academic_Year: '',
    Term: '',
    Amount_Due: 0,
    Amount_Paid: 0,
    Payment_Method: '',
    Payment_Date: todayISO,
    Reference: '',
    Notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
    const loadStudents = useCallback(async () => {
    try {
      setStudents(await listStudents());
    } catch (err) {
      setStudents([]);
      addToast('error', getThrownErrorMessage(err, 'Unable to load students.'));
    }
  }, [addToast]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  /** Students shown in the picker. Withdrawn students are excluded because the
   * backend rejects payments for them; everything else (Active, Graduated,
   * Suspended) is allowed since `students.create` only blocks Withdrawn. */
  const pickableStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (s.Status === 'Withdrawn') return false;
      if (term === '') return true;
      const name = [s.First_Name, s.Last_Name].filter(Boolean).join(' ').toLowerCase();
      return (
        name.includes(term) ||
        String(s.Student_ID).toLowerCase().includes(term) ||
        String(s.Class ?? '').toLowerCase().includes(term)
      );
    });
  }, [students, studentSearch]);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setForm((f) => ({ ...f })); // keep amount/method/date, reset term/year implicitly
    void loadFeeRecords(student.Student_ID);
  };

  const loadFeeRecords = useCallback(
    async (studentId: string) => {
      setBalanceLoading(true);
      setBalanceError(null);
      try {
        const records = await listFeedingFees({ Student_ID: studentId });
        setFeeRecords(records);
      } catch (err) {
        setFeeRecords([]);
        setBalanceError(
          getThrownErrorMessage(err, "Unable to load this student's payment records.")
        );
      } finally {
        setBalanceLoading(false);
      }
    },
    []
  );

  /** Sum of the backend-reported Balance across the student's active records. */
  const outstandingBalance = useMemo(
    () =>
      feeRecords
        .filter((p) => p.Status !== 'Voided')
        .reduce((sum, p) => sum + (Number(p.Balance) || 0), 0),
    [feeRecords]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const errs: Record<string, string> = {};
    if (!form.Academic_Year.trim()) {
      errs.Academic_Year = FIELD_LABELS.Academic_Year + ' is required';
    }
    if (!form.Term) errs.Term = FIELD_LABELS.Term + ' is required';
    if (!form.Payment_Method) {
      errs.Payment_Method = FIELD_LABELS.Payment_Method + ' is required';
    }
    if (Number(form.Amount_Due) <= 0) {
      errs.Amount_Due = FIELD_LABELS.Amount_Due + ' must be greater than 0';
    }
    if (Number(form.Amount_Paid) < 0) {
      errs.Amount_Paid = FIELD_LABELS.Amount_Paid + ' cannot be negative';
    }
    if (Number(form.Amount_Paid) > Number(form.Amount_Due)) {
      errs.Amount_Paid =
        FIELD_LABELS.Amount_Paid + ' cannot exceed ' + FIELD_LABELS.Amount_Due;
    }
    if (!form.Payment_Date) {
      errs.Payment_Date = FIELD_LABELS.Payment_Date + ' is required';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    if (!selectedStudent) return;

    setSubmitting(true);
    try {
      await createFeedingFee({
        Student_ID: selectedStudent.Student_ID,
        Academic_Year: form.Academic_Year.trim(),
        Term: form.Term as Term,
        Amount_Due: Number(form.Amount_Due),
        Amount_Paid: Number(form.Amount_Paid),
        Payment_Method: form.Payment_Method as PaymentMethod,
        Payment_Date: form.Payment_Date,
        Reference: form.Reference.trim(),
        Notes: form.Notes.trim(),
      });
      addToast('success', 'Payment recorded');
      navigate('/feeding-fees');
    } catch (err) {
      const code = getThrownErrorCode(err);
      if (code === 'VALIDATION_ERROR') {
        const fieldErrs: Record<string, string> = {};
        for (const f of getMissingFields(err)) {
          fieldErrs[f] = (FIELD_LABELS[f] ?? f) + ' is required';
        }
        const fieldErr = extractFieldError(err);
        if (fieldErr.field) {
          fieldErrs[fieldErr.field] = fieldErr.message;
        }
        if (Object.keys(fieldErrs).length > 0) {
          setFieldErrors(fieldErrs);
        } else {
          setFormError(getThrownErrorMessage(err, 'Unable to record this payment.'));
        }
      } else {
        setFormError(getThrownErrorMessage(err, 'Unable to record this payment.'));
      }
    } finally {
      setSubmitting(false);
    }
    };

  if (canCreate === null) {
    return <LoadingState message="Checking permissions..." />;
  }

  if (canCreate === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Record Feeding Fee Payment</h1>
          <p className="text-gray-500 mt-1">Permission required</p>
        </div>
        <div className="card p-8 text-center text-gray-500">
          <p>You do not have permission to record school fee payments.</p>
          <p className="mt-2 text-sm">
            Ask your administrator to grant the FEEDING_FEES.CREATE permission.
          </p>
        </div>
      </div>
    );
  }

  const studentLabel = (s: Student) =>
    [s.First_Name, s.Last_Name].filter(Boolean).join(' ').trim() || s.Student_ID;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Record Feeding Fee Payment
          </h1>
          <p className="text-gray-500 mt-1">
            {selectedStudent
              ? 'Student: ' + studentLabel(selectedStudent)
              : 'Search for a student to begin'}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/feeding-fees')}>
          Back to Feeding Fees
        </Button>
      </div>

      {/* STEP 1: pick a student */}
      {!selectedStudent && (
        <Card>
          <CardHeader title="Select student" />
          <CardBody>
            <SearchInput
              value={studentSearch}
              onChange={setStudentSearch}
              placeholder="Search by name, ID or class"
              className="max-w-md"
            />
            {pickableStudents.length === 0 ? (
              <EmptyState
                title="No matching students"
                description={
                  studentSearch
                    ? 'Try a different name, ID or class.'
                    : 'No active students are available.'
                }
                className="mt-4"
              />
            ) : (
              <ul className="mt-3 space-y-1">
                {pickableStudents.map((s) => (
                  <li key={s.Student_ID}>
                    <button
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{studentLabel(s)}</div>
                      <div className="text-sm text-gray-500">
                        {s.Student_ID} · {s.Class || '—'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
            {/* STEP 2: current balance + payment form, shown once a student is chosen */}
      {selectedStudent && (
        <>
          <Card padding="none">
            <CardHeader title="Current balance" />
            <CardBody>
              {balanceLoading ? (
                <LoadingState message="Loading payment records..." />
              ) : balanceError ? (
                <ErrorState
                  title="Unable to load payment records"
                  message={balanceError}
                  retry={() => void loadFeeRecords(selectedStudent.Student_ID)}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard
                      title="Outstanding Balance"
                      value={formatAmount(outstandingBalance)}
                      subtitle="Sum of active balances"
                    />
                    <StatCard
                      title="Payment Records"
                      value={feeRecords.length}
                      subtitle="All records"
                    />
                    <StatCard
                      title="Active Records"
                      value={feeRecords.filter((p) => p.Status !== 'Voided').length}
                      subtitle="Non-voided"
                    />
                  </div>

                  {feeRecords.length > 0 ? (
                    <div className="mt-4 overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Year</th>
                            <th>Term</th>
                            <th className="text-right">Due</th>
                            <th className="text-right">Paid</th>
                            <th className="text-right">Balance</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feeRecords.map((p) => (
                            <tr key={p.Payment_ID}>
                              <td>{p.Academic_Year || '—'}</td>
                              <td>{p.Term || '—'}</td>
                              <td className="text-right">{formatAmount(p.Amount_Due)}</td>
                              <td className="text-right">{formatAmount(p.Amount_Paid)}</td>
                              <td className="text-right">{formatAmount(p.Balance)}</td>
                              <td>
                                <StatusBadge
                                  label={p.Status}
                                  variant={getStatusVariant(p.Status)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="No payment records"
                      description="This student has no recorded fee payments yet."
                      className="mt-4"
                    />
                  )}
                                </>
              )}
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader
              title="Payment details"
              action={
                formError ? <span className="text-sm text-red-600">{formError}</span> : undefined
              }
            />
            <CardBody>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <FormInput
                    label="Student"
                    name="Student_ID"
                    value={selectedStudent.Student_ID}
                    readOnly
                    hint={studentLabel(selectedStudent)}
                  />
                </div>
                <FormInput
                  label="Academic Year"
                  name="Academic_Year"
                  value={form.Academic_Year}
                  onChange={(e) => setForm((f) => ({ ...f, Academic_Year: e.target.value }))}
                  error={fieldErrors.Academic_Year}
                  placeholder="e.g. 2024/2025"
                />
                <FormSelect
                  label="Term"
                  name="Term"
                  value={form.Term}
                  onChange={(e) => setForm((f) => ({ ...f, Term: e.target.value }))}
                  options={TERM_OPTIONS}
                  error={fieldErrors.Term}
                />
                <CurrencyInput
                  label="Amount Due"
                  name="Amount_Due"
                  value={form.Amount_Due}
                  onChange={(n) => setForm((f) => ({ ...f, Amount_Due: n }))}
                  error={fieldErrors.Amount_Due}
                />
                <CurrencyInput
                  label="Amount Paid"
                  name="Amount_Paid"
                  value={form.Amount_Paid}
                  onChange={(n) => setForm((f) => ({ ...f, Amount_Paid: n }))}
                  error={fieldErrors.Amount_Paid}
                />
                <FormSelect
                  label="Payment Method"
                  name="Payment_Method"
                  value={form.Payment_Method}
                  onChange={(e) => setForm((f) => ({ ...f, Payment_Method: e.target.value }))}
                  options={PAYMENT_METHOD_OPTIONS}
                  error={fieldErrors.Payment_Method}
                />
                <DateInput
                  label="Payment Date"
                  name="Payment_Date"
                  value={form.Payment_Date}
                  onChange={(e) => setForm((f) => ({ ...f, Payment_Date: e.target.value }))}
                  error={fieldErrors.Payment_Date}
                />
                <div className="md:col-span-2">
                  <FormInput
                    label="Reference"
                    name="Reference"
                    value={form.Reference}
                    onChange={(e) => setForm((f) => ({ ...f, Reference: e.target.value }))}
                    error={fieldErrors.Reference}
                    hint="Optional — e.g. receipt number or bank transfer reference"
                  />
                </div>
                <div className="md:col-span-2">
                  <FormTextarea
                    label="Notes"
                    name="Notes"
                    value={form.Notes}
                    onChange={(e) => setForm((f) => ({ ...f, Notes: e.target.value }))}
                    error={fieldErrors.Notes}
                  />
                </div>
                <div className="md:col-span-2 flex items-center justify-end gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate('/feeding-fees')}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" loading={submitting}>
                    Record Payment
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default CreateFeedingFee;
