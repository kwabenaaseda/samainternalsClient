/**
 * Students
 *
 * The students list: real data from `students.list`, client-side search, and
 * explicit loading / empty / error states.
 *
 * CONTRACT (Students.js)
 *   students.list -> success({ students, count })   requires STUDENTS.READ
 *   The endpoint takes no filter parameters, so search is client-side over the
 *   rows the backend returned. No new endpoints, no page-sized fetches.
 *
 * PERMISSIONS
 *   The list itself needs STUDENTS.READ; the backend enforces it and returns
 *   FORBIDDEN otherwise, which surfaces through the error state. "Add student"
 *   is only rendered when the caller holds STUDENTS.CREATE, so the UI never
 *   offers an action the backend would refuse.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listStudents } from '../../api/students';
import { getThrownErrorMessage } from '../../api/response';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
  StatusBadge,
  getStatusVariant,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { PermissionGate } from '../../hooks';
import type { Student } from '../../types';

/** Columns the client-side search matches against. */
const SEARCHABLE: (keyof Student)[] = [
  'Student_ID',
  'First_Name',
  'Last_Name',
  'Class',
  'Parent_Guardian',
  'Guardian_Phone',
  'Guardian_Email',
];

export function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listStudents();
      setStudents(rows);
    } catch (err) {
      // Never present a failed read as "no students".
      setStudents([]);
      setError(getThrownErrorMessage(err, 'Unable to load students.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === '') return students;
    return students.filter((student) =>
      SEARCHABLE.some((field) =>
        String(student[field] ?? '').toLowerCase().includes(term)
      )
    );
  }, [students, search]);

  const columns: Column<Student>[] = [
    { key: 'Student_ID', header: 'Student ID', sortable: true, width: '140px' },
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="font-medium text-gray-900">
          {[row.First_Name, row.Last_Name].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    { key: 'Gender', header: 'Gender' },
    { key: 'Class', header: 'Class', sortable: true },
    { key: 'Parent_Guardian', header: 'Guardian' },
    { key: 'Guardian_Phone', header: 'Phone' },
    {
      key: 'Status',
      header: 'Status',
      render: (row) => (
        <StatusBadge
          label={row.Status || 'Unknown'}
          variant={getStatusVariant(row.Status || '')}
        />
      ),
    },
    {
      key: 'view',
      header: '',
      width: '80px',
      render: () => <span className="text-sm font-medium text-primary">View</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">Manage student records</p>
        </div>
        <PermissionGate permission="STUDENTS.CREATE">
          <Button variant="primary" onClick={() => navigate('/students/create')}>
            + Add Student
          </Button>
        </PermissionGate>
      </div>

      {loading && <LoadingState message="Loading students..." />}

      {!loading && error && (
        <div className="card p-6">
          <ErrorState
            title="Unable to load students"
            message={error}
            retry={() => void load()}
          />
        </div>
      )}

      {!loading && !error && students.length === 0 && (
        <div className="card p-6">
          <PermissionGate
            permission="STUDENTS.CREATE"
            fallback={
              <EmptyState
                title="No students yet"
                description="Student records will appear here once they have been added."
              />
            }
          >
            <EmptyState
              title="No students yet"
              description="Add the first student to start building the register."
              action={{
                label: 'Add student',
                onClick: () => navigate('/students/create'),
              }}
            />
          </PermissionGate>
        </div>
      )}

      {!loading && !error && students.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name, ID, class, guardian or phone"
              className="w-full sm:max-w-md"
            />
            <p className="text-sm text-gray-500">
              {filtered.length} of {students.length}{' '}
              {students.length === 1 ? 'student' : 'students'}
            </p>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            keyField="Student_ID"
            onRowClick={(row) => navigate('/students/' + row.Student_ID)}
            emptyMessage="No students match your search"
          />
        </>
      )}
    </div>
  );
}

export default Students;
