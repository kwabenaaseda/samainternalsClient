/**
 * SchoolFees
 *
 * Fee ACCOUNTS and their payment TRANSACTIONS (Option 2 contract).
 *
 *   schoolFees.list  -> the fee accounts (School_Fees rows). Amount_Paid /
 *                       Balance / Status on each are re-derived server-side from
 *                       the ledger (SchoolFees.js enrichSchoolFeeRecords_), so
 *                       they are already ledger-true by the time they arrive.
 *   feePayments.list -> one account's payment transactions + server totals
 *   schoolFees.void  -> voids the whole ACCOUNT (School_Fees row)
 *   feePayments.void -> voids ONE payment transaction (School_Fee_Payments row)
 *
 * THE TWO VOIDS ARE DIFFERENT OPERATIONS
 *   Voiding an account is a correction of the obligation; the account keeps its
 *   transactions. Voiding a transaction reverses one payment and leaves the
 *   account in place. Both are gated on the existing SCHOOL_FEES.VOID code and
 *   are labelled distinctly here so neither can be mistaken for the other.
 *
 * The frontend only reads the backend's own Amount_Due / Amount_Paid / Balance /
 * Status values and sums them for the summary cards; it never recomputes a
 * balance from raw amounts.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSchoolFees, voidSchoolFee } from '../../api/schoolFees';
import { listFeePaymentsForAccount, voidFeePayment } from '../../api/feePayments';
import { listStudents } from '../../api/students';
import { getThrownErrorMessage } from '../../api/response';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingState,
  SearchInput,
  StatCard,
  StatusBadge,
  getStatusVariant,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { useToast } from '../../contexts';
import { usePermissions, PermissionGate } from '../../hooks';
import type { FeePayment, FeePaymentLedger, Payment, PermissionCode } from '../../types';

const PAGE_PERMISSIONS: PermissionCode[] = [
  'SCHOOL_FEES.READ',
  'SCHOOL_FEES.CREATE',
  'SCHOOL_FEES.VOID',
];

const STATUS_OPTIONS = [
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'Partial', label: 'Partial' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Voided', label: 'Voided' },
];

/** Fee-account columns the client-side search matches against. */
const SEARCHABLE: (keyof Payment)[] = [
  'Payment_ID',
  'Student_ID',
  'Academic_Year',
  'Term',
  'Reference',
  'Notes',
];

/** Currency formatting, matching Dashboard's GHS convention. */
function formatAmount(value: number | undefined): string {
  const n = Number(value) || 0;
  return `GHS ${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SchoolFees() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canVoid = permissions.get('SCHOOL_FEES.VOID') === true;

  const [accounts, setAccounts] = useState<Payment[]>([]);
  const [studentNames, setStudentNames] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // --- The account whose transactions are on screen ---
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<FeePaymentLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // --- Two distinct voids ---
  const [accountVoidTarget, setAccountVoidTarget] = useState<Payment | null>(null);
  const [accountVoiding, setAccountVoiding] = useState(false);
  const [paymentVoidTarget, setPaymentVoidTarget] = useState<FeePayment | null>(null);
  const [paymentVoiding, setPaymentVoiding] = useState(false);

  const loadStudents = useCallback(async () => {
    try {
      const rows = await listStudents();
      const names = new Map<string, string>();
      for (const s of rows) {
        const name = [s.First_Name, s.Last_Name].filter(Boolean).join(' ').trim();
        names.set(s.Student_ID, name);
      }
      setStudentNames(names);
    } catch {
      // Student names are a convenience; the list still renders Student_ID.
      setStudentNames(new Map());
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listSchoolFees());
    } catch (err) {
      setAccounts([]);
      setError(getThrownErrorMessage(err, 'Unable to load school fee accounts.'));
    } finally {
      setLoading(false);
    }
  }, []);

  /** The selected account's transactions + its server-derived totals. */
  const loadLedger = useCallback(async (feeId: string) => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      setLedger(await listFeePaymentsForAccount(feeId));
    } catch (err) {
      setLedger(null);
      setLedgerError(
        getThrownErrorMessage(err, "Unable to load this account's transactions.")
      );
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadStudents();
  }, [load, loadStudents]);

  /** Open (or collapse) one account's payment transactions. */
  const toggleAccount = (account: Payment) => {
    if (openAccountId === account.Payment_ID) {
      setOpenAccountId(null);
      setLedger(null);
      setLedgerError(null);
      return;
    }
    setOpenAccountId(account.Payment_ID);
    setLedger(null);
    void loadLedger(account.Payment_ID);
  };

  /** Void the whole fee ACCOUNT (schoolFees.void). */
  const handleAccountVoidConfirm = async () => {
    if (!accountVoidTarget) return;
    setAccountVoiding(true);
    try {
      await voidSchoolFee(accountVoidTarget.Payment_ID);
      addToast('success', 'Fee account ' + accountVoidTarget.Payment_ID + ' voided');
      setAccountVoidTarget(null);
      await load();
      if (openAccountId === accountVoidTarget.Payment_ID) {
        await loadLedger(accountVoidTarget.Payment_ID);
      }
    } catch (err) {
      addToast(
        'error',
        getThrownErrorMessage(err, 'Unable to void this fee account.')
      );
    } finally {
      setAccountVoiding(false);
    }
  };

  /** Void ONE payment TRANSACTION (feePayments.void). */
  const handlePaymentVoidConfirm = async () => {
    if (!paymentVoidTarget || !openAccountId) return;
    setPaymentVoiding(true);
    try {
      await voidFeePayment(paymentVoidTarget.Payment_ID);
      addToast(
        'success',
        'Payment ' + paymentVoidTarget.Payment_ID + ' voided'
      );
      setPaymentVoidTarget(null);
      // The transaction changed, so the account's aggregates changed with it.
      await loadLedger(openAccountId);
      await load();
    } catch (err) {
      addToast(
        'error',
        getThrownErrorMessage(err, 'Unable to void this payment.')
      );
    } finally {
      setPaymentVoiding(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const status = statusFilter;
    return accounts.filter((p) => {
      if (status && p.Status !== status) return false;
      if (term === '') return true;
      if (SEARCHABLE.some((f) => String(p[f] ?? '').toLowerCase().includes(term))) {
        return true;
      }
      const name = studentNames.get(p.Student_ID);
      return name?.toLowerCase().includes(term) ?? false;
    });
  }, [accounts, search, statusFilter, studentNames]);

  /** Summary figures, computed only by summing server-reported fields. */
  const stats = useMemo(() => {
    const active = accounts.filter((p) => p.Status !== 'Voided');
    const collected = active.reduce((sum, p) => sum + (Number(p.Amount_Paid) || 0), 0);
    const outstanding = active.reduce((sum, p) => sum + (Number(p.Balance) || 0), 0);
    return { collected, outstanding, count: active.length };
  }, [accounts]);

  /** The account whose transactions are displayed below the table. */
  const openAccount = useMemo(
    () => accounts.find((a) => a.Payment_ID === openAccountId) || null,
    [accounts, openAccountId]
  );

  /** The open account's figures, preferring the ledger response's own totals. */
  const openTotals = ledger
    ? {
        Fee_Amount: Number(ledger.account.Fee_Amount) || 0,
        Total_Paid: Number(ledger.account.Total_Paid) || 0,
        Outstanding: Number(ledger.account.Outstanding) || 0,
        Status: ledger.account.Status,
      }
    : openAccount
      ? {
          Fee_Amount: Number(openAccount.Amount_Due) || 0,
          Total_Paid: Number(openAccount.Amount_Paid) || 0,
          Outstanding: Number(openAccount.Balance) || 0,
          Status: openAccount.Status,
        }
      : null;

  /** Newest transactions first (ISO dates, so a string sort is chronological). */
  const transactions = useMemo<FeePayment[]>(() => {
    if (!ledger) return [];
    return [...ledger.payments].sort((a, b) =>
      String(b.Payment_Date || '').localeCompare(String(a.Payment_Date || ''))
    );
  }, [ledger]);

  /** Fee ACCOUNT columns. Amount_Paid/Balance are already ledger-derived. */
  const columns: Column<Payment>[] = [
    { key: 'Payment_ID', header: 'Fee account', sortable: true, width: '120px' },
    {
      key: 'student',
      header: 'Student',
      render: (row) => {
        const name = studentNames.get(row.Student_ID) || '';
        return (
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">
              {name || row.Student_ID}
            </div>
            <div className="text-xs text-gray-500">{row.Student_ID}</div>
          </div>
        );
      },
    },
    { key: 'Academic_Year', header: 'Academic year', sortable: true },
    { key: 'Term', header: 'Term', sortable: true },
    {
      key: 'Amount_Due',
      header: 'Amount due',
      sortable: true,
      width: '110px',
      render: (row) => (
        <span className="block text-right">{formatAmount(row.Amount_Due)}</span>
      ),
    },
    {
      key: 'Amount_Paid',
      header: 'Amount paid',
      sortable: true,
      width: '110px',
      render: (row) => (
        <span className="block text-right">{formatAmount(row.Amount_Paid)}</span>
      ),
    },
    {
      key: 'Balance',
      header: 'Balance',
      sortable: true,
      width: '110px',
      render: (row) => {
        const outstanding = Number(row.Balance) || 0;
        return (
          <span
            className={
              'block text-right font-medium ' +
              (outstanding > 0 ? 'text-red-700' : 'text-gray-900')
            }
          >
            {formatAmount(outstanding)}
          </span>
        );
      },
    },
    {
      key: 'Status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <StatusBadge label={row.Status} variant={getStatusVariant(row.Status)} />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '190px',
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAccount(row);
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {openAccountId === row.Payment_ID ? 'Hide' : 'Transactions'}
          </button>
          {canVoid && row.Status !== 'Voided' ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAccountVoidTarget(row);
              }}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Void account
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">School Fees</h1>
          <p className="text-gray-500 mt-1">
            Fee accounts and the payments recorded against them
          </p>
        </div>
        <PermissionGate permission="SCHOOL_FEES.CREATE">
          <Button variant="primary" onClick={() => navigate('/school-fees/new')}>
            + Record Payment
          </Button>
        </PermissionGate>
      </div>

      {loading && <LoadingState message="Loading school fee accounts..." />}

      {!loading && error && (
        <div className="card p-6">
          <ErrorState
            title="Unable to load school fee accounts"
            message={error}
            retry={() => void load()}
          />
        </div>
      )}

      {!loading && !error && accounts.length === 0 && (
        <div className="card p-6">
          <PermissionGate
            permission="SCHOOL_FEES.CREATE"
            fallback={
              <EmptyState
                title="No fee accounts yet"
                description="A fee account (fee amount for a student, academic year and term) must exist before money can be recorded against it."
              />
            }
          >
            <EmptyState
              title="No fee accounts yet"
              description="A fee account must exist before a payment can be recorded against it. Once an account is in place, use Record payment to capture money received."
              action={{
                label: 'Record payment',
                onClick: () => navigate('/school-fees/new'),
              }}
            />
          </PermissionGate>
        </div>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Collected"
              value={formatAmount(stats.collected)}
              subtitle="Sum of non-voided accounts"
            />
            <StatCard
              title="Outstanding Balance"
              value={formatAmount(stats.outstanding)}
              subtitle="Unpaid / partial balances"
            />
            <StatCard
              title="Fee Accounts"
              value={stats.count}
              subtitle="Non-voided accounts"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by student, account ID, year, term or reference"
                className="flex-1"
              />
              <div className="w-44">
                <FilterSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={STATUS_OPTIONS}
                  placeholder="All statuses"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {filtered.length} of {accounts.length} fee account
              {accounts.length === 1 ? '' : 's'}
            </p>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            keyField="Payment_ID"
            onRowClick={toggleAccount}
            emptyMessage="No fee accounts match your search"
          />
        </>
      )}

      {/* Payment TRANSACTIONS of the opened fee account. The amounts here are
          per-payment; the account's own totals sit in the panel header. */}
      {openAccountId && (
        <Card padding="none">
          <CardHeader
            title={
              openTotals
                ? 'Payment transactions - ' +
                  openAccountId +
                  ' (' +
                  formatAmount(openTotals.Total_Paid) +
                  ' paid of ' +
                  formatAmount(openTotals.Fee_Amount) +
                  ', ' +
                  formatAmount(openTotals.Outstanding) +
                  ' outstanding)'
                : 'Payment transactions - ' + openAccountId
            }
            action={
              openTotals ? (
                <StatusBadge
                  label={openTotals.Status}
                  variant={getStatusVariant(openTotals.Status)}
                />
              ) : undefined
            }
          />
          <CardBody>
            {ledgerLoading ? (
              <LoadingState message="Loading payment transactions..." />
            ) : ledgerError ? (
              <ErrorState
                title="Unable to load payment transactions"
                message={ledgerError}
                retry={() => void loadLedger(openAccountId)}
              />
            ) : transactions.length === 0 ? (
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
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((p, index) => (
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
                        <td>
                          {canVoid && p.Status !== 'Voided' ? (
                            <button
                              type="button"
                              onClick={() => setPaymentVoidTarget(p)}
                              className="text-xs font-medium text-red-600 hover:text-red-800"
                            >
                              Void
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Voids ONE payment transaction (feePayments.void). */}
      <ConfirmDialog
        isOpen={!!paymentVoidTarget}
        onClose={() => setPaymentVoidTarget(null)}
        onConfirm={() => void handlePaymentVoidConfirm()}
        title="Void this payment transaction?"
        message={
          paymentVoidTarget
            ? 'This will mark payment ' +
              paymentVoidTarget.Payment_ID +
              ' (' +
              formatAmount(paymentVoidTarget.Amount) +
              ') as Voided. The transaction is preserved but stops counting toward ' +
              'the account balance. The fee account itself is not voided.'
            : ''
        }
        confirmLabel="Void transaction"
        cancelLabel="Cancel"
        variant="danger"
        loading={paymentVoiding}
      />

      {/* Voids the whole fee ACCOUNT (schoolFees.void). */}
      <ConfirmDialog
        isOpen={!!accountVoidTarget}
        onClose={() => setAccountVoidTarget(null)}
        onConfirm={() => void handleAccountVoidConfirm()}
        title="Void this fee account?"
        message={
          accountVoidTarget
            ? 'This will mark fee account ' +
              accountVoidTarget.Payment_ID +
              ' as Voided. The account and its payment transactions are ' +
              'preserved for historical reporting, but the account no longer ' +
              'counts toward balances or collected totals.'
            : ''
        }
        confirmLabel="Void account"
        cancelLabel="Cancel"
        variant="danger"
        loading={accountVoiding}
      />
    </div>
  );
}

export default SchoolFees;
