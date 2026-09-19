/**
 * Inventory list page (MVP1). Contract from inventory.ts:
 * listInventory({Category?, Status?}) -> items; stockIn/stockOut({Item_ID, Quantity, Reason?, Notes?});
 * getInventoryMovements(itemId) for history; createInventoryItem for new items (inline modal here).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createInventoryItem, getInventoryMovements, listInventory, stockIn, stockOut } from '../../api/inventory';
import { getThrownErrorMessage } from '../../api/response';
import { Button, DataTable, EmptyState, ErrorState, FilterSelect, FormInput, LoadingState, Modal, SearchInput, StatusBadge, getStatusVariant } from '../../components/ui';
import type { Column } from '../../components/ui';
import { PermissionGate } from '../../hooks';
import { useToast } from '../../contexts';
import type { InventoryItem, InventoryMovement } from '../../types';
const STATUS_OPTIONS = [{ value: 'In Stock', label: 'In Stock' }, { value: 'Low Stock', label: 'Low Stock' }, { value: 'Out of Stock', label: 'Out of Stock' }];
type StockMode = 'in' | 'out';
export function Inventory() {
  const { addToast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stockTarget, setStockTarget] = useState<InventoryItem | null>(null);
  const [stockMode, setStockMode] = useState<StockMode>('in');
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stocking, setStocking] = useState(false);
  const [histTarget, setHistTarget] = useState<InventoryItem | null>(null);
  const [histRows, setHistRows] = useState<InventoryMovement[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ Item_Name: '', Category: '', Unit: '', Selling_Price: 0, Current_Quantity: 0, Minimum_Stock_Level: 0 });
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await listInventory()); }
    catch (err) { setError(getThrownErrorMessage(err, 'Failed to load inventory')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter && i.Status !== statusFilter) return false;
      if (!q) return true;
      return [i.Item_ID, i.Item_Name, i.Category ?? '', i.Unit ?? ''].join(' ').toLowerCase().includes(q);
    });
  }, [items, search, statusFilter]);
  const openStock = (item: InventoryItem, mode: StockMode) => { setStockTarget(item); setStockMode(mode); setStockQty(''); setStockReason(''); };
  const handleStock = async () => {
    if (!stockTarget) return;
    const qty = Number(stockQty);
    if (!Number.isInteger(qty) || qty <= 0) { addToast('error', 'Quantity must be a positive whole number.'); return; }
    setStocking(true);
    try {
      if (stockMode === 'in') await stockIn({ Item_ID: stockTarget.Item_ID, Quantity: qty, Reason: stockReason.trim() });
      else await stockOut({ Item_ID: stockTarget.Item_ID, Quantity: qty, Reason: stockReason.trim() });
      addToast('success', stockMode === 'in' ? `Stocked in ${qty} x ${stockTarget.Item_Name}.` : `Stocked out ${qty} x ${stockTarget.Item_Name}.`);
      setStockTarget(null);
      await load();
    } catch (err) { addToast('error', getThrownErrorMessage(err, 'Stock update failed.')); }
    finally { setStocking(false); }
  };
  const openHistory = useCallback(async (item: InventoryItem) => {
    setHistTarget(item); setHistLoading(true); setHistError(null);
    try { setHistRows(await getInventoryMovements(item.Item_ID)); }
    catch (err) { setHistRows([]); setHistError(getThrownErrorMessage(err, 'Unable to load movement history.')); }
    finally { setHistLoading(false); }
  }, []);
  const handleCreate = async () => {
    if (!createForm.Item_Name.trim()) { addToast('error', 'Item name is required.'); return; }
    if (!(Number(createForm.Selling_Price) >= 0)) { addToast('error', 'Selling price cannot be negative.'); return; }
    setCreating(true);
    try {
      await createInventoryItem({ Item_Name: createForm.Item_Name.trim(), Category: createForm.Category.trim(), Unit: createForm.Unit.trim(), Selling_Price: Number(createForm.Selling_Price), Current_Quantity: Number(createForm.Current_Quantity), Minimum_Stock_Level: Number(createForm.Minimum_Stock_Level) });
      addToast('success', `Item ${createForm.Item_Name.trim()} created.`);
      setShowCreate(false);
      setCreateForm({ Item_Name: '', Category: '', Unit: '', Selling_Price: 0, Current_Quantity: 0, Minimum_Stock_Level: 0 });
      await load();
    } catch (err) { addToast('error', getThrownErrorMessage(err, 'Failed to create item.')); }
    finally { setCreating(false); }
  };
  const columns: Column<InventoryItem>[] = [
    { key: 'Item_ID', header: 'ID', sortable: true },
    { key: 'Item_Name', header: 'Item', sortable: true, render: (r) => (<div><div className="font-medium text-gray-900">{r.Item_Name}</div><div className="text-xs text-gray-500">{r.Category || '---'}</div></div>) },
    { key: 'Unit', header: 'Unit', render: (r) => r.Unit || '---' },
    { key: 'Selling_Price', header: 'Price', render: (r) => `GHS ${Number(r.Selling_Price).toFixed(2)}` },
    { key: 'Current_Quantity', header: 'Qty' },
    { key: 'Minimum_Stock_Level', header: 'Min' },
    { key: 'Status', header: 'Status', render: (row) => (<StatusBadge label={row.Status} variant={getStatusVariant(row.Status)} />) },
    { key: 'actions', header: '', render: (row) => (<div className="flex gap-1" onClick={(e) => e.stopPropagation()}><PermissionGate permission="INVENTORY.ADJUST"><Button variant="ghost" size="sm" onClick={() => openStock(row, 'in')}>In</Button><Button variant="ghost" size="sm" onClick={() => openStock(row, 'out')}>Out</Button></PermissionGate><Button variant="ghost" size="sm" onClick={() => void openHistory(row)}>History</Button></div>) },
  ];
  if (loading) return <LoadingState message="Loading inventory..." />;
  if (error) return <ErrorState title="Unable to load inventory" message={error} retry={() => void load()} />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-semibold text-gray-900">Inventory</h1><p className="text-gray-500 mt-1">Stock items and movements</p></div>
        <PermissionGate permission="INVENTORY.CREATE"><Button onClick={() => setShowCreate(true)}>Add item</Button></PermissionGate>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search items..." className="flex-1" />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} placeholder="All statuses" className="sm:w-48" />
      </div>
      {filtered.length === 0 ? (<EmptyState title={items.length === 0 ? 'No inventory items yet' : 'No matching items'} description={items.length === 0 ? 'Add an item to get started.' : 'Try adjusting your search or filter.'} />) : (<DataTable columns={columns} data={filtered} keyField="Item_ID" emptyMessage="No inventory items" />)}
      <Modal isOpen={stockTarget !== null} onClose={() => setStockTarget(null)} title={`${stockMode === 'in' ? 'Stock in' : 'Stock out'}: ${stockTarget?.Item_Name ?? ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Current quantity: <span className="font-semibold">{stockTarget?.Current_Quantity}</span></p>
          <FormInput label="Quantity" name="Quantity" type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} hint="Positive whole number" />
          <FormInput label="Reason" name="Reason" value={stockReason} onChange={(e) => setStockReason(e.target.value)} hint="Optional" />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setStockTarget(null)} disabled={stocking}>Cancel</Button>
            <Button onClick={() => void handleStock()} loading={stocking}>{stockMode === 'in' ? 'Stock in' : 'Stock out'}</Button>
          </div>
        </div>
      </Modal>
      <Modal isOpen={histTarget !== null} onClose={() => setHistTarget(null)} title={`Movements: ${histTarget?.Item_Name ?? ''}`}>
        {histLoading ? (<LoadingState message="Loading movements..." />) : histError ? (<ErrorState title="Unable to load movements" message={histError} retry={() => histTarget && void openHistory(histTarget)} />) : histRows.length === 0 ? (<EmptyState title="No movements yet" description="Stock changes will appear here." />) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {histRows.map((m) => (<li key={m.Movement_ID} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="font-medium">{m.Movement_Type === 'STOCK_IN' ? '+' : '-'}{m.Quantity}</span><span className="text-gray-500">{m.Date}</span><span className="text-gray-500">{m.Reason || '---'}</span></li>))}
          </ul>
        )}
      </Modal>
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add inventory item">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><FormInput label="Item name" name="Item_Name" value={createForm.Item_Name} onChange={(e) => setCreateForm((f) => ({ ...f, Item_Name: e.target.value }))} /></div>
          <FormInput label="Category" name="Category" value={createForm.Category} onChange={(e) => setCreateForm((f) => ({ ...f, Category: e.target.value }))} />
          <FormInput label="Unit" name="Unit" value={createForm.Unit} onChange={(e) => setCreateForm((f) => ({ ...f, Unit: e.target.value }))} hint="e.g. pcs, packs" />
          <FormInput label="Selling price" name="Selling_Price" type="number" value={String(createForm.Selling_Price)} onChange={(e) => setCreateForm((f) => ({ ...f, Selling_Price: Number(e.target.value) }))} />
          <FormInput label="Opening quantity" name="Current_Quantity" type="number" value={String(createForm.Current_Quantity)} onChange={(e) => setCreateForm((f) => ({ ...f, Current_Quantity: Number(e.target.value) }))} />
          <FormInput label="Minimum stock level" name="Minimum_Stock_Level" type="number" value={String(createForm.Minimum_Stock_Level)} onChange={(e) => setCreateForm((f) => ({ ...f, Minimum_Stock_Level: Number(e.target.value) }))} />
          <p className="sm:col-span-2 text-xs text-gray-500">Status is derived server-side from quantity; no selection needed.</p>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
          <Button onClick={() => void handleCreate()} loading={creating}>Add item</Button>
        </div>
      </Modal>
    </div>
  );
}
export default Inventory;
