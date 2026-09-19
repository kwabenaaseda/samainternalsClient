/**
 * SchoolFees
 *
 * List page for school fee payments. Real data from `schoolFees.list`, with a
 * student-name map (`listStudents`) so each Payment row shows the student.
 *
 * Money rules (SchoolFees.js):
 *  - Balance = Amount_Due - Amount_Paid  (server-calculated, read-only)
 *  - Status derived: Paid | Partial | Unpaid | Voided
 * The frontend only reads and sums the backend's own Balance/Status fields — it
 * never recomputes a balance from Amount_Due / Amount_Paid.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSchoolFees, voidSchoolFee } from '../../api/schoolFees';
import { listStudents } from '../../api/students';
import { getThrownErrorMessage } from '../../api/response';
import {
  Button,
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
import type { PermissionCode, Payment } from '../../types';

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

/** Payment columns the client-side search matches against. */
const SEARCHABLE: (keyof Payment)[] = [
  'Payment_ID',
  'Student_ID',
  'Academic_Year',
  'Term',
  'Payment_Method',
  'Reference',
  'Notes',
];

/** Currency formatting, matching Dashboard's GHS convention. */
function formatAmount(value: number): string {
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

  const [payments, setPayments] = useState<Payment[]>([]);
  const [studentNames, setStudentNames] = useState(new Map<string, string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voiding, setVoiding] = useState(false);

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
      setPayments(await listSchoolFees());
    } catch (err) {
      setPayments([]);
      setError(getThrownErrorMessage(err, 'Unable to load school fee payments.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, loadStudents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const status = statusFilter;
    return payments.filter((p) => {
      if (status && p.Status !== status) return false;
      if (term === '') return true;
      if (SEARCHABLE.some((f) => String(p[f] ?? '').toLowerCase().includes(term))) {
        return true;
      }
            const name = studentNames.get(p.Student_ID);
      return name?.toLowerCase().includes(term) ?? false;
    });
  }, [payments, search, statusFilter, studentNames]);

  /** Summary figures, computed only by summing server-reported fields. */
  const stats = useMemo(() => {
    const active = payments.filter((p) => p.Status !== 'Voided');
    const collected = active.reduce((sum, p) => sum + (Number(p.Amount_Paid) || 0), 0);
    const outstanding = active.reduce((sum, p) => sum + (Number(p.Balance) || 0), 0);
    return { collected, outstanding, count: active.length };
  }, [payments]);

  const handleVoidConfirm = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await voidSchoolFee(voidTarget.Payment_ID);
      setVoidTarget(null);
      addToast('success', `Payment ${voidTarget.Payment_ID} voided`);
      void load();
    } catch (err) {
      addToast('error', getThrownErrorMessage(err, 'Unable to void this payment.'));
    } finally {
      setVoiding(false);
    }
  };

  const columns: Column<Payment>[] = [
    { key: 'Payment_ID', header: 'Payment ID', sortable: true, width: '120px' },
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
            { key: 'Academic_Year', header: 'Academic Year', sortable: true },
    { key: 'Term', header: 'Term', sortable: true },
    {
      key: 'Amount_Due',
      header: 'Amount Due',
      sortable: true,
      width: '110px',
      render: (row) => <span className="block text-right">{formatAmount(row.Amount_Due)}</span>,
    },
    {
      key: 'Amount_Paid',
      header: 'Amount Paid',
      sortable: true,
      width: '110px',
      render: (row) => <span className="block text-right">{formatAmount(row.Amount_Paid)}</span>,
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
            className={`block text-right font-medium ${
              outstanding > 0 ? 'text-red-700' : 'text-gray-900'
            }`}
          >
            {formatAmount(outstanding)}
          </span>
        );
      },
    },
    { key: 'Payment_Date', header: 'Date', sortable: true, width: '120px' },
    { key: 'Payment_Method', header: 'Method', sortable: true },
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
      width: '80px',
      render: (row) =>
        canVoid && row.Status !== 'Voided' ? (
          <button
            type="button"
            onClick={() => setVoidTarget(row)}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Void
                    </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">School Fees</h1>
          <p className="text-gray-500 mt-1">Record and track school fee payments</p>
        </div>
        <PermissionGate permission="SCHOOL_FEES.CREATE">
          <Button variant="primary" onClick={() => navigate('/school-fees/new')}>
            + Record Payment
          </Button>
        </PermissionGate>
      </div>

      {loading && <LoadingState message="Loading school fee payments..." />}

      {!loading && error && (
        <div className="card p-6">
          <ErrorState
            title="Unable to load school fee payments"
            message={error}
            retry={() => void load()}
          />
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="card p-6">
          <PermissionGate
            permission="SCHOOL_FEES.CREATE"
            fallback={
              <EmptyState
                title="No school fee payments yet"
                description="Payment records will appear here once payments have been recorded."
              />
            }
          >
            <EmptyState
              title="No school fee payments yet"
              description="Record the first payment to start building the register."
              action={{
                label: 'Record payment',
                onClick: () => navigate('/school-fees/new'),
              }}
            />
          </PermissionGate>
        </div>
      )}

      {!loading && !error && payments.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Total Collected"
              value={formatAmount(stats.collected)}
              subtitle="All non-voided payments"
            />
            <StatCard
              title="Outstanding Balance"
              value={formatAmount(stats.outstanding)}
              subtitle="Unpaid / partial balances"
            />
            <StatCard
              title="Payments Recorded"
              value={stats.count}
              subtitle="Non-voided records"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by student, ID, year, term, method or reference"
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
              {filtered.length} of {payments.length} payment
              {payments.length === 1 ? '' : 's'}
            </p>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            keyField="Payment_ID"
            emptyMessage="No payments match your search"
          />
        </>
      )}

      <ConfirmDialog
        isOpen={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => void handleVoidConfirm()}
        title="Void this payment?"
        message={
          voidTarget
            ? 'This will mark payment ' +
              voidTarget.Payment_ID +
              ' as Voided. The record is preserved for historical reporting, ' +
              'but it no longer counts toward balances or collected totals.'
            : ''
        }
        confirmLabel="Void payment"
        cancelLabel="Cancel"
        variant="danger"
        loading={voiding}
      />
    </div>
  );
}

export default SchoolFees;
