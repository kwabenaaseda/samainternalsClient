/**
 * FeedingFees list page (MVP1). Mirrors SchoolFees: same states, gates, patterns.
 * Backend owns balances/status; frontend only renders them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFeedingFees, voidFeedingFee } from '../../api/feedingFees';
import { listStudents } from '../../api/students';
import { getThrownErrorMessage } from '../../api/response';
import { Button, ConfirmDialog, DataTable, EmptyState, ErrorState, FilterSelect, LoadingState, SearchInput, StatCard, StatusBadge, getStatusVariant } from '../../components/ui';
import type { Column } from '../../components/ui';
import { PermissionGate } from '../../hooks';
import { useToast } from '../../contexts';
import type { Payment } from '../../types';
function formatGHS(v: number): string { const n = Number(v) || 0; return `GHS ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
const STATUS_OPTIONS = [{ value: 'Unpaid', label: 'Unpaid' }, { value: 'Partial', label: 'Partial' }, { value: 'Paid', label: 'Paid' }, { value: 'Voided', label: 'Voided' }];
export function FeedingFees() {
  const { addToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [fees, students] = await Promise.all([listFeedingFees(), listStudents().catch(() => [])]);
      setPayments(fees);
      const names: Record<string, string> = {};
      for (const s of students) names[s.Student_ID] = `${s.First_Name} ${s.Last_Name}`.trim();
      setStudentNames(names);
    } catch (err) { setError(getThrownErrorMessage(err, 'Failed to load feeding fees')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter && p.Status !== statusFilter) return false;
      if (!q) return true;
      const student = studentNames[p.Student_ID] ?? '';
      return [p.Payment_ID, p.Student_ID, student, p.Academic_Year, p.Term, p.Payment_Method, p.Reference ?? '', p.Notes ?? ''].join(' ').toLowerCase().includes(q);
    });
  }, [payments, studentNames, search, statusFilter]);
  const totals = useMemo(() => {
    const active = payments.filter((p) => p.Status !== 'Voided');
    return { collected: active.reduce((s, p) => s + Number(p.Amount_Paid || 0), 0), outstanding: active.reduce((s, p) => s + Number(p.Balance || 0), 0), count: active.length };
  }, [payments]);
  const handleVoid = async () => {
    if (!voidTarget) return;
    setIsVoiding(true);
    try {
      await voidFeedingFee(voidTarget.Payment_ID);
      addToast('success', `Payment ${voidTarget.Payment_ID} voided.`);
      setVoidTarget(null);
      await load();
    } catch (err) { addToast('error', getThrownErrorMessage(err, 'Failed to void payment.')); }
    finally { setIsVoiding(false); }
  };
  const columns: Column<Payment>[] = [
    { key: 'Payment_ID', header: 'ID', sortable: true },
    { key: 'Student_ID', header: 'Student', sortable: true, render: (r) => (<div><div className="font-medium text-gray-900">{studentNames[r.Student_ID] || r.Student_ID}</div><div className="text-xs text-gray-500">{r.Student_ID}</div></div>) },
    { key: 'Academic_Year', header: 'Year', sortable: true },
    { key: 'Term', header: 'Term', sortable: true },
    { key: 'Amount_Due', header: 'Due', render: (r) => formatGHS(r.Amount_Due) },
    { key: 'Amount_Paid', header: 'Paid', render: (r) => formatGHS(r.Amount_Paid) },
    { key: 'Balance', header: 'Balance', render: (r) => formatGHS(r.Balance) },
    { key: 'Payment_Date', header: 'Date', sortable: true },
    { key: 'Status', header: 'Status', render: (row) => (<StatusBadge label={row.Status} variant={getStatusVariant(row.Status)} />) },
    { key: 'actions', header: '', render: (row) => (row.Status !== 'Voided' ? (<PermissionGate permission="FEEDING_FEES.VOID"><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setVoidTarget(row); }}>Void</Button></PermissionGate>) : null) },
  ];
  if (loading) return <LoadingState message="Loading feeding fees..." />;
  if (error) return <ErrorState title="Unable to load feeding fees" message={error} retry={() => void load()} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-gray-900">Feeding Fees</h1><p className="text-gray-500 mt-1">Termly feeding fee payments</p></div>
        <PermissionGate permission="FEEDING_FEES.CREATE"><Link to="/feeding-fees/new"><Button>Record payment</Button></Link></PermissionGate>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Collected" value={formatGHS(totals.collected)} subtitle="Active payments" />
        <StatCard title="Outstanding" value={formatGHS(totals.outstanding)} subtitle="Server-calculated balances" />
        <StatCard title="Payments" value={totals.count} subtitle="Excludes voided" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search payments, students, references..." className="flex-1" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="All statuses" className="sm:w-48" />
      </div>
      {filtered.length === 0 ? (<EmptyState title={payments.length === 0 ? 'No feeding fee payments yet' : 'No matching payments'} description={payments.length === 0 ? 'Record a payment to get started.' : 'Try adjusting your search or filter.'} />) : (<DataTable columns={columns} data={filtered} keyField="Payment_ID" emptyMessage="No feeding fee payments" />)}
      <ConfirmDialog isOpen={voidTarget !== null} onClose={() => setVoidTarget(null)} onConfirm={() => void handleVoid()} title="Void feeding fee payment" message={`Void payment ${voidTarget?.Payment_ID ?? ''}? This marks it voided but keeps the record.`} confirmLabel="Void payment" loading={isVoiding} />
    </div>
  );
}
export default FeedingFees;
