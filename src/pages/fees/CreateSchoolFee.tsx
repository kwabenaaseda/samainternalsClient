/**
 * CreateSchoolFee
 *
 * The "Record Payment" flow for school fees, against the Option 2 backend
 * contract (SchoolFeePayments.js). No new endpoints are introduced:
 *
 *   students.list      -> pick the student
 *   schoolFees.list    -> that student's fee ACCOUNTS (year + term obligations)
 *   feePayments.list   -> the selected account's transactions + server totals
 *   feePayments.create -> record the money actually received
 *
 * MONEY MODEL:
 *   A School_Fees row is a fee ACCOUNT whose Amount_Due is the FEE AMOUNT --
 *   not a payment. Money is recorded as a School_Fee_Payments TRANSACTION whose
 *   Amount is the amount received. Amount_Paid / Balance / Status on the account
 *   are server-derived aggregates over the non-voided transactions.
 *
 *   This form therefore:
 *     - never sends Amount_Paid, Payment_Method or Payment_Date to
 *       schoolFees.create (it does not call schoolFees.create at all),
 *     - never treats Amount_Due as the payment amount,
 *     - sends only { Fee_ID, Amount, Payment_Method, Payment_Date, Reference,
 *       Notes } to feePayments.create.
 *
 *   Balances shown after a payment come from the backend's own response
 *   (`account`) and from a refreshed feePayments.list read. The form never
 *   computes an authoritative balance of its own.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSchoolFees } from '../../api/schoolFees';
import { createFeePayment, listFeePaymentsForAccount } from '../../api/feePayments';
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
import type {
  FeePayment,
  FeePaymentLedger,
  FeePaymentMutationResult,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PermissionCode,
  Student,
} from '../../types';

const PAGE_PERMISSIONS: PermissionCode[] = [
  'SCHOOL_FEES.CREATE',
  'SCHOOL_FEES.READ',
  'STUDENTS.READ',
];

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Mobile Money', label: 'Mobile Money' },
  { value: 'Other', label: 'Other' },
];

/** Labels for the fee-payment fields the backend reports errors against. */
const FIELD_LABELS: Record<string, string> = {
  Fee_ID: 'Fee account',
  Amount: 'Amount received',
  Payment_Method: 'Payment method',
  Payment_Date: 'Payment date',
  Reference: 'Reference',
  Notes: 'Notes',
};

/** Today's date as a YYYY-MM-DD string for the payment date default. */
const todayISO = new Date().toISOString().split('T')[0];

/** Currency formatting, matching Dashboard's GHS convention. */
function formatAmount(value: number | undefined): string {
  const n = Number(value) || 0;
  return `GHS ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The field name a backend VALIDATION_ERROR points at, if any. */
function readErrorField(error: unknown): string | undefined {
  const details = ((error ?? {}) as { details?: { field?: unknown } }).details;
  return details && typeof details.field === 'string' ? details.field : undefined;
}

/** The account figures the UI displays; always the backend's own numbers. */
interface AccountView {
  Fee_ID: string;
  Academic_Year: string;
  Term: string;
  /** Fee amount (School_Fees.Amount_Due). */
  Fee_Amount: number;
  /** Sum of non-voided transactions. */
  Total_Paid: number;
  /** Fee_Amount - Total_Paid. */
  Outstanding: number;
  Status: PaymentStatus;
}

export function CreateSchoolFee() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canRecord = permissions.get('SCHOOL_FEES.CREATE') === true;

  // --- Step 1: pick a student ---
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // --- Step 2: the student's fee ACCOUNTS (year + term obligations) ---
  const [accounts, setAccounts] = useState<Payment[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Payment | null>(null);

  // --- Step 3: the selected account's transactions + server totals ---
  const [ledger, setLedger] = useState<FeePaymentLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // --- The payment form. Amount is the money RECEIVED, never Amount_Due. ---
  const [form, setForm] = useState({
    Amount: 0,
    Payment_Method: 'Cash',
    Payment_Date: todayISO,
    Reference: '',
    Notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<FeePaymentMutationResult | null>(null);

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

  /** Students offered in the picker. Withdrawn students are excluded because
   * the backend refuses new money for them; every other status is allowed. */
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

  /** The student's fee accounts. The backend re-derives Amount_Paid/Balance/
   * Status from the School_Fee_Payments ledger on every read. */
  const loadAccounts = useCallback(async (studentId: string) => {
    setAccountsLoading(true);
    setAccountsError(null);
    try {
      setAccounts(await listSchoolFees({ Student_ID: studentId }));
    } catch (err) {
      setAccounts([]);
      setAccountsError(
        getThrownErrorMessage(err, "Unable to load this student's fee accounts.")
      );
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  /** The account's transactions plus its server-derived totals. */
  const loadLedger = useCallback(async (feeId: string) => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      setLedger(await listFeePaymentsForAccount(feeId));
    } catch (err) {
      setLedger(null);
      setLedgerError(
        getThrownErrorMessage(err, "Unable to load this account's payment transactions.")
      );
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const resetFormForSelection = useCallback(() => {
    setForm((f) => ({ ...f, Amount: 0, Reference: '', Notes: '' }));
    setFieldErrors({});
    setFormError('');
  }, []);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setSelectedAccount(null);
    setLedger(null);
    setLastResult(null);
    resetFormForSelection();
    void loadAccounts(student.Student_ID);
  };

  const handleSelectAccount = (account: Payment) => {
    setSelectedAccount(account);
    setLedger(null);
    setLastResult(null);
    resetFormForSelection();
    void loadLedger(account.Payment_ID);
  };

  /**
   * The selected account's figures. Once the ledger has loaded, its `account`
   * block is the freshest server-derived truth (it is what feePayments.create
   * just recomputed), so it wins over the earlier list snapshot.
   */
  const accountView = useMemo<AccountView | null>(() => {
    if (!selectedAccount) return null;
    if (ledger) {
      return {
        Fee_ID: ledger.account.Fee_ID,
        Academic_Year: ledger.account.Academic_Year,
        Term: ledger.account.Term,
        Fee_Amount: Number(ledger.account.Fee_Amount) || 0,
        Total_Paid: Number(ledger.account.Total_Paid) || 0,
        Outstanding: Number(ledger.account.Outstanding) || 0,
        Status: ledger.account.Status,
      };
    }
    return {
      Fee_ID: selectedAccount.Payment_ID,
      Academic_Year: selectedAccount.Academic_Year,
      Term: selectedAccount.Term,
      Fee_Amount: Number(selectedAccount.Amount_Due) || 0,
      Total_Paid: Number(selectedAccount.Amount_Paid) || 0,
      Outstanding: Number(selectedAccount.Balance) || 0,
      Status: selectedAccount.Status,
    };
  }, [selectedAccount, ledger]);

  /** The balance a payment may not exceed, as the backend defines it. */
  const outstanding = accountView ? accountView.Outstanding : 0;

  /** Accounts that can still take money: not voided, not fully settled. */
  const hasPayableAccount = useMemo(
    () => accounts.some((a) => a.Status !== 'Voided' && (Number(a.Balance) || 0) > 0),
    [accounts]
  );

  /** Newest transactions first (ISO dates, so a string sort is chronological). */
  const sortedPayments = useMemo<FeePayment[]>(() => {
    if (!ledger) return [];
    return [...ledger.payments].sort((a, b) =>
      String(b.Payment_Date || '').localeCompare(String(a.Payment_Date || ''))
    );
  }, [ledger]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    if (!selectedStudent || !selectedAccount) return;

    const amount = Number(form.Amount);
    const errs: Record<string, string> = {};

    // Mirror of the backend's own rules (SchoolFeePayments.js): the Amount is
    // the money received, it must be positive and may not exceed Outstanding.
    if (!(amount > 0)) {
      errs.Amount = FIELD_LABELS.Amount + ' must be greater than 0';
    } else if (amount > outstanding) {
      errs.Amount =
        'Amount cannot exceed the outstanding balance (' + formatAmount(outstanding) + ')';
    }
    if (!form.Payment_Method) {
      errs.Payment_Method = FIELD_LABELS.Payment_Method + ' is required';
    }
    if (!form.Payment_Date) {
      errs.Payment_Date = FIELD_LABELS.Payment_Date + ' is required';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      // The ONLY write this page performs: one payment transaction against an
      // existing fee account. No schoolFees.create call, so Amount_Paid /
      // Payment_Method / Payment_Date can never be sent to the account row.
      const result = await createFeePayment({
        Fee_ID: selectedAccount.Payment_ID,
        Amount: amount,
        Payment_Method: form.Payment_Method as PaymentMethod,
        Payment_Date: form.Payment_Date,
        Reference: form.Reference.trim(),
        Notes: form.Notes.trim(),
      });

      setLastResult(result);
      addToast('success', 'Payment ' + result.payment.Payment_ID + ' recorded');
      setForm((f) => ({ ...f, Amount: 0, Reference: '', Notes: '' }));

      // Refresh the account's transactions and server-derived totals, then the
      // student's account list, so the updated balance is what the user sees.
      await loadLedger(selectedAccount.Payment_ID);
      await loadAccounts(selectedStudent.Student_ID);
    } catch (err) {
      const code = getThrownErrorCode(err);
      if (code === 'VALIDATION_ERROR') {
        const fieldErrs: Record<string, string> = {};
        for (const f of getMissingFields(err)) {
          fieldErrs[f] = (FIELD_LABELS[f] ?? f) + ' is required';
        }
        const field = readErrorField(err);
        if (field) {
          fieldErrs[field] = getThrownErrorMessage(
            err,
            'Unable to record this payment.'
          );
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

  if (canRecord === null) {
    return <LoadingState message="Checking permissions..." />;
  }

  if (canRecord === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Record School Fee Payment
          </h1>
          <p className="text-gray-500 mt-1">Permission required</p>
        </div>
        <div className="card p-8 text-center text-gray-500">
          <p>You do not have permission to record school fee payments.</p>
          <p className="mt-2 text-sm">
            Ask your administrator to grant the SCHOOL_FEES.CREATE permission.
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
            Record School Fee Payment
          </h1>
          <p className="text-gray-500 mt-1">
            {selectedStudent
              ? 'Student: ' + studentLabel(selectedStudent)
              : 'Search for a student to begin'}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/school-fees')}>
          Back to School Fees
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
                {pickableStudents.map((s, index) => (
                  <li key={s.Student_ID || 'student-' + index}>
                    <button
                      type="button"
                      onClick={() => handleSelectStudent(s)}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{studentLabel(s)}</div>
                      <div className="text-sm text-gray-500">
                        {s.Student_ID} - {s.Class || 'n/a'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {/* STEP 2: choose one of the student's fee accounts (year + term) */}
      {selectedStudent && (
        <Card padding="none">
          <CardHeader
            title="Fee accounts"
            action={
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleSelectStudent(selectedStudent)}
              >
                Change student
              </Button>
            }
          />
          <CardBody>
            {accountsLoading ? (
              <LoadingState message="Loading fee accounts..." />
            ) : accountsError ? (
              <ErrorState
                title="Unable to load fee accounts"
                message={accountsError}
                retry={() => void loadAccounts(selectedStudent.Student_ID)}
              />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="No fee accounts"
                description="This student has no school fee account yet. A fee account must exist for an academic year and term before money can be recorded against it."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fee account</th>
                        <th>Academic year</th>
                        <th>Term</th>
                        <th className="text-right">Amount due</th>
                        <th className="text-right">Amount paid</th>
                        <th className="text-right">Outstanding</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a, index) => {
                        const isSelected = selectedAccount?.Payment_ID === a.Payment_ID;
                        const payable =
                          a.Status !== 'Voided' && (Number(a.Balance) || 0) > 0;
                        return (
                          <tr
                            key={a.Payment_ID || 'account-' + index}
                            className={isSelected ? 'bg-gray-50' : ''}
                          >
                            <td className="font-medium text-gray-900">
                              {a.Payment_ID}
                            </td>
                            <td>{a.Academic_Year || 'n/a'}</td>
                            <td>{a.Term || 'n/a'}</td>
                            <td className="text-right">{formatAmount(a.Amount_Due)}</td>
                            <td className="text-right">{formatAmount(a.Amount_Paid)}</td>
                            <td className="text-right">{formatAmount(a.Balance)}</td>
                            <td>
                              <StatusBadge
                                label={a.Status}
                                variant={getStatusVariant(a.Status)}
                              />
                            </td>
                            <td>
                              {payable ? (
                                <button
                                  type="button"
                                  onClick={() => handleSelectAccount(a)}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">
                                  {a.Status === 'Voided' ? 'Voided' : 'Settled'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!hasPayableAccount && (
                  <p className="mt-4 text-sm text-gray-500">
                    Every fee account for this student is settled or voided, so there
                    is nothing left to pay.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* STEP 3: the selected account, its transactions and the payment form */}
      {selectedStudent && selectedAccount && accountView && (
        <>
          <Card>
            <CardHeader
              title={'Fee account ' + accountView.Fee_ID}
              action={
                <StatusBadge
                  label={accountView.Status}
                  variant={getStatusVariant(accountView.Status)}
                />
              }
            />
            <CardBody>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Student</dt>
                  <dd className="font-medium text-gray-900">
                    {studentLabel(selectedStudent)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Academic year</dt>
                  <dd className="font-medium text-gray-900">
                    {accountView.Academic_Year || 'n/a'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Term</dt>
                  <dd className="font-medium text-gray-900">{accountView.Term || 'n/a'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Transactions</dt>
                  <dd className="font-medium text-gray-900">
                    {ledger ? ledger.payments.length : 'n/a'}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  title="Amount Due"
                  value={formatAmount(accountView.Fee_Amount)}
                  subtitle="Fee amount for this account"
                />
                <StatCard
                  title="Amount Paid"
                  value={formatAmount(accountView.Total_Paid)}
                  subtitle="Sum of non-voided payments"
                />
                <StatCard
                  title="Outstanding Balance"
                  value={formatAmount(accountView.Outstanding)}
                  subtitle={
                    accountView.Outstanding > 0 ? 'Still to be paid' : 'Fully settled'
                  }
                />
              </div>
            </CardBody>
          </Card>

          {lastResult && (
            <div className="card p-4 border-l-4 border-green-500">
              <p className="font-medium text-gray-900">
                Payment {lastResult.payment.Payment_ID} recorded -{' '}
                {formatAmount(lastResult.payment.Amount)}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Updated balance for {accountView.Fee_ID}:{' '}
                {formatAmount(lastResult.account.Amount_Paid)} paid of{' '}
                {formatAmount(lastResult.account.Amount_Due)},{' '}
                {formatAmount(lastResult.account.Outstanding)} outstanding.
              </p>
            </div>
          )}

          <Card padding="none">
            <CardHeader title="Payment transactions" />
            <CardBody>
              {ledgerLoading ? (
                <LoadingState message="Loading payment transactions..." />
              ) : ledgerError ? (
                <ErrorState
                  title="Unable to load payment transactions"
                  message={ledgerError}
                  retry={() => void loadLedger(selectedAccount.Payment_ID)}
                />
              ) : sortedPayments.length === 0 ? (
                <EmptyState
                  title="No payments recorded"
                  description="No money has been received against this fee account yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Payment ID</th>
                        <th className="text-right">Amount</th>
                        <th>Payment method</th>
                        <th>Payment date</th>
                        <th>Reference</th>
                        <th>Recorded by</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPayments.map((p, index) => (
                        <tr key={p.Payment_ID || 'payment-' + index}>
                          <td className="font-medium text-gray-900">{p.Payment_ID}</td>
                          <td className="text-right">{formatAmount(p.Amount)}</td>
                          <td>{p.Payment_Method || 'n/a'}</td>
                          <td>{p.Payment_Date || 'n/a'}</td>
                          <td>{p.Reference || 'n/a'}</td>
                          <td>{p.Recorded_By || 'n/a'}</td>
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
              )}
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader
              title="Record payment"
              action={
                formError ? (
                  <span className="text-sm text-red-600">{formError}</span>
                ) : undefined
              }
            />
            <CardBody>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                <div className="md:col-span-2">
                  <FormInput
                    label="Fee account"
                    name="Fee_ID"
                    value={accountView.Fee_ID}
                    readOnly
                    hint={
                      (accountView.Academic_Year || 'n/a') +
                      ' - ' +
                      (accountView.Term || 'n/a') +
                      ' - outstanding ' +
                      formatAmount(accountView.Outstanding)
                    }
                  />
                </div>

                {/* The money actually received. This is NOT the fee amount. */}
                <CurrencyInput
                  label="Amount received"
                  name="Amount"
                  value={form.Amount}
                  onChange={(n) => setForm((f) => ({ ...f, Amount: n }))}
                  error={fieldErrors.Amount}
                  hint={
                    'Up to ' +
                    formatAmount(accountView.Outstanding) +
                    ' may be recorded against this account.'
                  }
                />
                <FormSelect
                  label="Payment method"
                  name="Payment_Method"
                  value={form.Payment_Method}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, Payment_Method: e.target.value }))
                  }
                  options={PAYMENT_METHOD_OPTIONS}
                  error={fieldErrors.Payment_Method}
                />
                <DateInput
                  label="Payment date"
                  name="Payment_Date"
                  value={form.Payment_Date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, Payment_Date: e.target.value }))
                  }
                  error={fieldErrors.Payment_Date}
                />
                <FormInput
                  label="Reference"
                  name="Reference"
                  value={form.Reference}
                  onChange={(e) => setForm((f) => ({ ...f, Reference: e.target.value }))}
                  error={fieldErrors.Reference}
                  hint="Optional - receipt or bank reference"
                />
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
                    onClick={() => navigate('/school-fees')}
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

export default CreateSchoolFee;
