/**
 * Stationery list page (MVP1). Real data from stationery.list.
 * Fulfillment: stationery.fulfill reads payload.Quantity_Given (backend field).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fulfillStationery, listStationery } from '../../api/stationery';
import { listStudents } from '../../api/students';
import { getThrownErrorMessage } from '../../api/response';
import { Button, DataTable, EmptyState, ErrorState, FilterSelect, FormInput, LoadingState, Modal, SearchInput, StatusBadge, getStatusVariant } from '../../components/ui';
import type { Column } from '../../components/ui';
import { PermissionGate, MultiPermissionGate } from '../../hooks';
import { useToast } from '../../contexts';
import type { StationeryTransaction } from '../../types';
const STATUS_OPTIONS = [{ value: 'Pending', label: 'Pending' }, { value: 'Partial', label: 'Partial' }, { value: 'Fulfilled', label: 'Fulfilled' }, { value: 'Voided', label: 'Voided' }];
export function Stationery() {
  const { addToast } = useToast();
  const [rows, setRows] = useState<StationeryTransaction[]>([]);
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fulfillTarget, setFulfillTarget] = useState<StationeryTransaction | null>(null);
  const [fulfillQty, setFulfillQty] = useState('');
  const [fulfilling, setFulfilling] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [txns, students] = await Promise.all([listStationery(), listStudents().catch(() => [])]);
      setRows(txns);
      const names: Record<string, string> = {};
      for (const s of students) names[s.Student_ID] = `${s.First_Name} ${s.Last_Name}`.trim();
      setStudentNames(names);
    } catch (err) { setError(getThrownErrorMessage(err, 'Failed to load stationery transactions')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((t) => {
      if (statusFilter && t.Fulfillment_Status !== statusFilter) return false;
      if (!q) return true;
      const student = studentNames[t.Student_ID] ?? '';
      return [t.Transaction_ID, t.Student_ID, student, t.Item_ID, t.Reference ?? '', t.Notes ?? ''].join(' ').toLowerCase().includes(q);
    });
  }, [rows, studentNames, search, statusFilter]);
  const openFulfill = (t: StationeryTransaction) => { setFulfillTarget(t); setFulfillQty(String(t.Quantity_Remaining)); };
  const handleFulfill = async () => {
    if (!fulfillTarget) return;
    const qty = Number(fulfillQty);
    if (!Number.isFinite(qty) || qty <= 0) { addToast('error', 'Enter a quantity greater than zero.'); return; }
    if (qty > Number(fulfillTarget.Quantity_Remaining)) { addToast('error', `Only ${fulfillTarget.Quantity_Remaining} remain to fulfill.`); return; }
    setFulfilling(true);
    try {
      await fulfillStationery({ Transaction_ID: fulfillTarget.Transaction_ID, Quantity_Given: qty });
      addToast('success', `Fulfilled ${qty} item(s) for ${fulfillTarget.Transaction_ID}.`);
      setFulfillTarget(null);
      await load();
    } catch (err) { addToast('error', getThrownErrorMessage(err, 'Failed to record fulfillment.')); }
    finally { setFulfilling(false); }
  };
  const columns: Column<StationeryTransaction>[] = [
    { key: 'Transaction_ID', header: 'ID', sortable: true },
    { key: 'Student_ID', header: 'Student', sortable: true, render: (r) => (<div><div className="font-medium text-gray-900">{studentNames[r.Student_ID] || r.Student_ID}</div><div className="text-xs text-gray-500">{r.Student_ID}</div></div>) },
    { key: 'Item_ID', header: 'Item', sortable: true },
    { key: 'Quantity_Purchased', header: 'Qty' },
    { key: 'Quantity_Given', header: 'Given' },
    { key: 'Quantity_Remaining', header: 'Remaining' },
    { key: 'Fulfillment_Status', header: 'Status', render: (row) => (<StatusBadge label={row.Fulfillment_Status} variant={getStatusVariant(row.Fulfillment_Status)} />) },
    { key: 'actions', header: '', render: (row) => (row.Fulfillment_Status !== 'Fulfilled' && row.Fulfillment_Status !== 'Voided' ? (<MultiPermissionGate permissions={['STATIONERY.FULFILL', 'INVENTORY.ADJUST']}><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openFulfill(row); }}>Fulfill</Button></MultiPermissionGate>) : null) },
  ];
  if (loading) return <LoadingState message="Loading stationery transactions..." />;
  if (error) return <ErrorState title="Unable to load stationery" message={error} retry={() => void load()} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-gray-900">Stationery</h1><p className="text-gray-500 mt-1">Stationery sales and fulfillment</p></div>
        <PermissionGate permission="STATIONERY.CREATE"><Link to="/stationery/new"><Button>New transaction</Button></Link></PermissionGate>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search transactions, students, items..." className="flex-1" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="All statuses" className="sm:w-48" />
      </div>
      {filtered.length === 0 ? (<EmptyState title={rows.length === 0 ? 'No stationery transactions yet' : 'No matching transactions'} description={rows.length === 0 ? 'Record a transaction to get started.' : 'Try adjusting your search or filter.'} />) : (<DataTable columns={columns} data={filtered} keyField="Transaction_ID" emptyMessage="No stationery transactions" />)}
      <Modal isOpen={fulfillTarget !== null} onClose={() => setFulfillTarget(null)} title={`Fulfill ${fulfillTarget?.Transaction_ID ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Remaining: <span className="font-semibold">{fulfillTarget?.Quantity_Remaining}</span>. This reduces inventory stock.</p>
          <FormInput label="Quantity to give" name="Quantity_Given" type="number" value={fulfillQty} onChange={(e) => setFulfillQty(e.target.value)} hint={`Max ${fulfillTarget?.Quantity_Remaining}`} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFulfillTarget(null)} disabled={fulfilling}>Cancel</Button>
            <Button onClick={() => void handleFulfill()} loading={fulfilling}>Record fulfillment</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default Stationery;
