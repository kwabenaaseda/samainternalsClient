/**
 * CreateStationery (MVP1). Contract from Stationery.js handleStationeryCreate_:
 * required: Student_ID, Item_ID, Quantity_Purchased, Amount_Paid, Payment_Method, Payment_Date.
 * Unit_Price is server-derived from the inventory item's Selling_Price (NOT sent).
 * Total/Balance/Status are server-calculated.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStationery } from '../../api/stationery';
import { listStudents } from '../../api/students';
import { listInventory } from '../../api/inventory';
import { getMissingFields, getThrownErrorCode, getThrownErrorMessage } from '../../api/response';
import { Button, Card, CardBody, CardHeader, CurrencyInput, DateInput, EmptyState, ErrorState, FormInput, FormSelect, FormTextarea, LoadingState, SearchInput, StatCard } from '../../components/ui';
import { useToast } from '../../contexts';
import { usePermissions } from '../../hooks';
import type { InventoryItem, PaymentMethod, PermissionCode, Student } from '../../types';
const PAGE_PERMISSIONS: PermissionCode[] = ['STATIONERY.CREATE', 'STATIONERY.READ', 'STUDENTS.READ', 'INVENTORY.READ'];
const PAYMENT_METHOD_OPTIONS = [{ value: 'Cash', label: 'Cash' }, { value: 'Bank Transfer', label: 'Bank Transfer' }, { value: 'Mobile Money', label: 'Mobile Money' }, { value: 'Other', label: 'Other' }];
const FIELD_LABELS: Record<string, string> = { Student_ID: 'Student', Item_ID: 'Item', Quantity_Purchased: 'Quantity purchased', Amount_Paid: 'Amount paid', Payment_Method: 'Payment method', Payment_Date: 'Payment date', Reference: 'Reference', Notes: 'Notes' };
const todayISO = new Date().toISOString().split('T')[0];
export function CreateStationery() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canCreate = permissions.get('STATIONERY.CREATE') === true;
  const [students, setStudents] = useState<Student[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ Item_ID: '', Quantity_Purchased: 1, Amount_Paid: 0, Payment_Method: '', Payment_Date: todayISO, Reference: '', Notes: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const boot = useCallback(async () => {
    setBootLoading(true); setBootError(null);
    try {
      const [s, it] = await Promise.all([listStudents(), listInventory()]);
      setStudents(s); setItems(it);
    } catch (err) { setBootError(getThrownErrorMessage(err, 'Unable to load students and inventory.')); }
    finally { setBootLoading(false); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  const pickableStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (s.Status === 'Withdrawn') return false;
      if (term === '') return true;
      const name = [s.First_Name, s.Last_Name].filter(Boolean).join(' ').toLowerCase();
      return name.includes(term) || String(s.Student_ID).toLowerCase().includes(term) || String(s.Class ?? '').toLowerCase().includes(term);
    });
  }, [students, studentSearch]);
  const selectedItem = useMemo(() => items.find((i) => i.Item_ID === form.Item_ID) ?? null, [items, form.Item_ID]);
  const previewTotal = useMemo(() => {
    if (!selectedItem) return 0;
    return Number(form.Quantity_Purchased || 0) * Number(selectedItem.Selling_Price || 0);
  }, [selectedItem, form.Quantity_Purchased]);
  const studentLabel = (s: Student) => [s.First_Name, s.Last_Name].filter(Boolean).join(' ').trim() || s.Student_ID;
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(''); setFieldErrors({});
    const errs: Record<string, string> = {};
    if (!selectedStudent) errs.Student_ID = 'Choose a student first';
    if (!form.Item_ID) errs.Item_ID = 'Choose an item';
    if (!(Number(form.Quantity_Purchased) > 0)) errs.Quantity_Purchased = 'Quantity must be greater than 0';
    if (Number(form.Amount_Paid) < 0) errs.Amount_Paid = 'Amount paid cannot be negative';
    if (Number(form.Amount_Paid) > previewTotal) errs.Amount_Paid = `Amount paid cannot exceed total GHS ${previewTotal.toFixed(2)}`;
    if (!form.Payment_Method) errs.Payment_Method = 'Payment method is required';
    if (!form.Payment_Date) errs.Payment_Date = 'Payment date is required';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setSubmitting(true);
    try {
      await createStationery({ Student_ID: selectedStudent!.Student_ID, Item_ID: form.Item_ID, Quantity_Purchased: Number(form.Quantity_Purchased), Amount_Paid: Number(form.Amount_Paid), Payment_Method: form.Payment_Method as PaymentMethod, Payment_Date: form.Payment_Date, Reference: form.Reference.trim(), Notes: form.Notes.trim() });
      addToast('success', 'Stationery transaction recorded');
      navigate('/stationery');
    } catch (err) {
      if (getThrownErrorCode(err) === 'VALIDATION_ERROR') {
        const fieldErrs: Record<string, string> = {};
        for (const f of getMissingFields(err)) fieldErrs[f] = (FIELD_LABELS[f] ?? f) + ' is required';
        if (Object.keys(fieldErrs).length > 0) setFieldErrors(fieldErrs);
        else setFormError(getThrownErrorMessage(err, 'Unable to record this transaction.'));
      } else setFormError(getThrownErrorMessage(err, 'Unable to record this transaction.'));
    } finally { setSubmitting(false); }
  };
  if (canCreate === null || bootLoading) return <LoadingState message="Loading..." />;
  if (bootError) return <ErrorState title="Unable to load" message={bootError} retry={() => void boot()} />;
  if (canCreate === false) return (<div className="space-y-6"><div><h1 className="text-2xl font-semibold text-gray-900">New Stationery Transaction</h1><p className="text-gray-500 mt-1">Permission required</p></div><div className="card p-8 text-center text-gray-500"><p>You do not have permission to record stationery transactions.</p></div></div>);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold text-gray-900">New Stationery Transaction</h1><p className="text-gray-500 mt-1">{selectedStudent ? 'Student: ' + studentLabel(selectedStudent) : 'Search for a student to begin'}</p></div>
        <Button type="button" variant="secondary" onClick={() => navigate('/stationery')}>Back to Stationery</Button>
      </div>
      {!selectedStudent && (<Card><CardHeader title="Select student" /><CardBody><SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search by name, ID or class" className="max-w-md" />{pickableStudents.length === 0 ? (<EmptyState title="No matching students" description="Try a different search." className="mt-4" />) : (<ul className="mt-3 space-y-1">{pickableStudents.map((s) => (<li key={s.Student_ID}><button type="button" onClick={() => setSelectedStudent(s)} className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50"><div className="font-medium text-gray-900">{studentLabel(s)}</div><div className="text-sm text-gray-500">{s.Student_ID} \u00b7 {s.Class || '---'}</div></button></li>))}</ul>)}</CardBody></Card>)}
      {selectedStudent && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Unit Price" value={`GHS ${Number(selectedItem?.Selling_Price ?? 0).toFixed(2)}`} subtitle={selectedItem ? selectedItem.Item_Name : 'Choose an item'} />
            <StatCard title="Preview Total" value={`GHS ${previewTotal.toFixed(2)}`} subtitle="Qty x unit price (server confirms)" />
            <StatCard title="In Stock" value={selectedItem ? selectedItem.Current_Quantity : '---'} subtitle={selectedItem ? selectedItem.Item_ID : 'No item selected'} />
          </div>
          <Card>
            <CardHeader title="Transaction details" />
            <CardBody>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2"><FormInput label="Student" name="Student_ID" value={selectedStudent.Student_ID} readOnly hint={studentLabel(selectedStudent)} /></div>
                <FormSelect label="Item" name="Item_ID" value={form.Item_ID} onChange={(e) => setForm((f) => ({ ...f, Item_ID: e.target.value }))} options={items.map((i) => ({ value: i.Item_ID, label: `${i.Item_Name} (${i.Item_ID}) - GHS ${Number(i.Selling_Price).toFixed(2)}` }))} error={fieldErrors.Item_ID} />
                <FormInput label="Quantity Purchased" name="Quantity_Purchased" type="number" value={String(form.Quantity_Purchased)} onChange={(e) => setForm((f) => ({ ...f, Quantity_Purchased: Number(e.target.value) }))} error={fieldErrors.Quantity_Purchased} />
                <CurrencyInput label="Amount Paid" name="Amount_Paid" value={form.Amount_Paid} onChange={(n) => setForm((f) => ({ ...f, Amount_Paid: n }))} error={fieldErrors.Amount_Paid} />
                <FormSelect label="Payment Method" name="Payment_Method" value={form.Payment_Method} onChange={(e) => setForm((f) => ({ ...f, Payment_Method: e.target.value }))} options={PAYMENT_METHOD_OPTIONS} error={fieldErrors.Payment_Method} />
                <DateInput label="Payment Date" name="Payment_Date" value={form.Payment_Date} onChange={(e) => setForm((f) => ({ ...f, Payment_Date: e.target.value }))} error={fieldErrors.Payment_Date} />
                <div className="md:col-span-2"><FormInput label="Reference" name="Reference" value={form.Reference} onChange={(e) => setForm((f) => ({ ...f, Reference: e.target.value }))} error={fieldErrors.Reference} /></div>
                <div className="md:col-span-2"><FormTextarea label="Notes" name="Notes" value={form.Notes} onChange={(e) => setForm((f) => ({ ...f, Notes: e.target.value }))} error={fieldErrors.Notes} /></div>
                {formError && (<div className="md:col-span-2"><span className="text-sm text-red-600">{formError}</span></div>)}
                <div className="md:col-span-2 flex items-center justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={() => navigate('/stationery')} disabled={submitting}>Cancel</Button>
                  <Button type="submit" variant="primary" loading={submitting}>Record Transaction</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
export default CreateStationery;
