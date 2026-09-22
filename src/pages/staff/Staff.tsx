/**
 * Staff
 *
 * The staff list: real data from `staff.list`, client-side search, explicit
 * loading / empty / error states, and the two record-mutating actions the
 * backend exposes for a staff row:
 *
 *   staff.update      via the Edit page    requires STAFF.UPDATE
 *   staff.deactivate  in place, confirmed  requires STAFF.DEACTIVATE
 *
 * CONTRACT (Staff.js)
 *   staff.list -> success({ staff, count })   requires STAFF.READ
 *   The endpoint takes no filter parameters and returns every row, so search and
 *   pagination are client-side over the rows the backend returned.
 *
 * PERMISSIONS
 *   The list itself needs STAFF.READ; the backend enforces it and returns
 *   FORBIDDEN otherwise, which surfaces through the error state.
 *   "Add Staff" is only rendered when the caller holds STAFF.CREATE, "Edit" when
 *   they hold STAFF.UPDATE, and "Deactivate" when they hold STAFF.DEACTIVATE —
 *   the exact code handleStaffDeactivate_ requires — so the UI never offers an
 *   action the backend would refuse.
 *
 * DEACTIVATION IS NOT DELETION
 *   Staff are never physically deleted. Deactivation calls `staff.deactivate`,
 *   which soft-sets Employment_Status='Inactive' and keeps the row for history.
 *   The row is replaced in place from the API response, so the new status shows
 *   immediately without a second round-trip.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deactivateStaff, listStaff } from '../../api/staff';
import { getThrownErrorMessage } from '../../api/response';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingState,
  Pagination,
  SearchInput,
  StatusBadge,
  getStatusVariant,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { PermissionGate, usePermissions } from '../../hooks';
import { useToast } from '../../contexts';
import type { PermissionCode, Staff } from '../../types';
import { STAFF_STATUS_OPTIONS } from './StaffForm';

/** Rows per page. staff.list returns every row, so paging is client-side. */
const PAGE_SIZE = 10;

/** Module-level so the array identity is stable across renders. */
const PAGE_PERMISSIONS: PermissionCode[] = ['STAFF.UPDATE', 'STAFF.DEACTIVATE'];

/** Status filter values: the backend's CONFIG.STAFF_STATUS values. FilterSelect
 *  prepends its own empty "All" entry, so no blank value is declared here. */
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = STAFF_STATUS_OPTIONS;

/** Currency formatting, matching the GHS convention used elsewhere in SAMS. */
function formatSalary(amount: number | undefined): string {
  if (amount === undefined || amount === null || !Number.isFinite(Number(amount))) {
    return '—';
  }
  return `GHS ${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Every value the client-side search matches against, as one lowercase string. */
function searchableText(member: Staff): string {
  return [
    member.Staff_ID,
    member.First_Name,
    member.Last_Name,
    member.Email ?? '',
    member.Position ?? '',
    member.Department ?? '',
    member.Phone ?? '',
    member.Employment_Status ?? '',
  ]
    .join(' ')
    .toLowerCase();
}


export function Staff() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<Staff | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const canEdit = permissions.get('STAFF.UPDATE') === true;
  const canDeactivate = permissions.get('STAFF.DEACTIVATE') === true;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await listStaff());
    } catch (err) {
      // Never present a failed read as "no staff".
      setStaff([]);
      setError(getThrownErrorMessage(err, 'Unable to load staff.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A new search or filter starts a new result set, so return to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((member) => {
      if (statusFilter !== '' && member.Employment_Status !== statusFilter) return false;
      if (term === '') return true;
      return searchableText(member).includes(term);
    });
  }, [staff, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const handleDeactivate = async () => {
    if (deactivateTarget === null) return;

    setDeactivating(true);
    try {
      // Returns the updated row (Employment_Status='Inactive'). Replacing it in
      // place flips the status badge immediately, with no second read.
      const updated = await deactivateStaff(deactivateTarget.Staff_ID);
      setStaff((prev) =>
        prev.map((row) => (row.Staff_ID === updated.Staff_ID ? updated : row))
      );
      addToast('success', 'Staff ' + updated.Staff_ID + ' deactivated.');
      setDeactivateTarget(null);
    } catch (err) {
      addToast(
        'error',
        getThrownErrorMessage(err, 'Unable to deactivate this staff member.')
      );
    } finally {
      setDeactivating(false);
    }
  };


  const columns: Column<Staff>[] = [
    { key: 'Staff_ID', header: 'Staff ID', sortable: true, width: '130px' },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {[row.First_Name, row.Last_Name].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    { key: 'Gender', header: 'Gender', render: (row) => row.Gender || '—' },
    { key: 'Position', header: 'Position', render: (row) => row.Position || '—' },
    { key: 'Department', header: 'Department', render: (row) => row.Department || '—' },
    { key: 'Phone', header: 'Phone', render: (row) => row.Phone || '—' },
    {
      key: 'Employment_Status',
      header: 'Employment Status',
      sortable: true,
      render: (row) => (
        <StatusBadge
          label={row.Employment_Status || 'Unknown'}
          variant={getStatusVariant(row.Employment_Status || '')}
        />
      ),
    },
    {
      key: 'Salary_Amount',
      header: 'Salary Amount',
      sortable: true,
      render: (row) => (
        <span className="text-gray-700">{formatSalary(row.Salary_Amount)}</span>
      ),
    },
    {
      key: 'Salary_Frequency',
      header: 'Salary Frequency',
      render: (row) => row.Salary_Frequency || '—',
    },
  ];

  // Only offer the actions column when at least one action is actually granted.
  if (canEdit || canDeactivate) {
    columns.push({
      key: 'actions',
      header: '',
      width: '190px',
      render: (row) => {
        const isInactive = row.Employment_Status === 'Inactive';
        return (
          <div className="flex items-center justify-end gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/staff/' + row.Staff_ID + '/edit');
                }}
              >
                Edit
              </Button>
            )}
            {canDeactivate && !isInactive && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeactivateTarget(row);
                }}
              >
                Deactivate
              </Button>
            )}
          </div>
        );
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Staff</h1>
          <p className="text-gray-500 mt-1">Manage staff records</p>
        </div>
        <PermissionGate permission="STAFF.CREATE">
          <Button variant="primary" onClick={() => navigate('/staff/create')}>
            + Add Staff
          </Button>
        </PermissionGate>
      </div>

      {loading && <LoadingState message="Loading staff..." />}

      {!loading && error && (
        <div className="card p-6">
          <ErrorState
            title="Unable to load staff"
            message={error}
            retry={() => void load()}
          />
        </div>
      )}

      {!loading && !error && staff.length === 0 && (
        <div className="card p-6">
          <PermissionGate
            permission="STAFF.CREATE"
            fallback={
              <EmptyState
                title="No staff yet"
                description="Staff records will appear here once they have been added."
              />
            }
          >
            <EmptyState
              title="No staff yet"
              description="Add the first staff member to start building the register."
              action={{
                label: 'Add staff',
                onClick: () => navigate('/staff/create'),
              }}
            />
          </PermissionGate>
        </div>
      )}

      {!loading && !error && staff.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, staff ID, email or position"
              className="w-full sm:max-w-md"
            />
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_FILTER_OPTIONS}
                placeholder="All statuses"
                className="sm:w-48"
              />
              <p className="text-sm text-gray-500">
                {filtered.length} of {staff.length}{' '}
                {staff.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-6">
              <EmptyState
                title="No matching staff"
                description="Try adjusting your search or status filter."
              />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <DataTable
                columns={columns}
                data={pageRows}
                keyField="Staff_ID"
                rowKey={(row) => row.Staff_ID}
                emptyMessage="No staff match your search"
                className="border-0 shadow-none rounded-none"
              />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={deactivateTarget !== null}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => void handleDeactivate()}
        title="Deactivate staff member"
        message={
          'This sets ' +
          ([deactivateTarget?.First_Name, deactivateTarget?.Last_Name]
            .filter(Boolean)
            .join(' ') || deactivateTarget?.Staff_ID || 'this staff member') +
          ' to Inactive. The staff record itself is kept for historical reporting.'
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        loading={deactivating}
      />
    </div>
  );
}

export default Staff;


