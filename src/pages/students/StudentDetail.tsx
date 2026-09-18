/**
 * StudentDetail
 *
 * One student, read from `students.get`, plus the two record-mutating actions
 * the backend exposes for a single student:
 *
 *   students.update    via the Edit page    requires STUDENTS.UPDATE
 *   students.withdraw  in place, confirmed  requires STUDENTS.WITHDRAW
 *
 * Withdrawal is the ONLY status transition offered anywhere in the UI: it calls
 * `students.withdraw`, which soft-deletes (Status='Withdrawn', Withdrawal_Date
 * set) and never removes the row. Nothing here writes the sheet directly.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStudent, withdrawStudent } from '../../api/students';
import { getThrownErrorCode, getThrownErrorMessage } from '../../api/response';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  LoadingState,
  StatusBadge,
  getStatusVariant,
} from '../../components/ui';
import { usePermissions } from '../../hooks';
import { useToast } from '../../contexts';
import type { PermissionCode, Student } from '../../types';

/** Module-level so the array identity is stable across renders. */
const DETAIL_PERMISSIONS: PermissionCode[] = ['STUDENTS.UPDATE', 'STUDENTS.WITHDRAW'];

/** One labelled value in a detail card, with a dash for empty columns. */
function DetailItem({ label, value }: { label: string; value?: string }) {
  const display = value === undefined || value === null || value === '' ? '—' : value;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 break-words">{display}</dd>
    </div>
  );
}

export function StudentDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(DETAIL_PERMISSIONS);

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const canEdit = permissions.get('STUDENTS.UPDATE') === true;
  const canWithdraw = permissions.get('STUDENTS.WITHDRAW') === true;
  const isWithdrawn = student?.Status === 'Withdrawn';

  const load = useCallback(async () => {
    if (id === '') {
      setStudent(null);
      setLoading(false);
      setError('No student was specified in the address.');
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode('');
    try {
      setStudent(await getStudent(id));
    } catch (err) {
      setStudent(null);
      setError(getThrownErrorMessage(err, 'Unable to load this student.'));
      setErrorCode(getThrownErrorCode(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWithdraw = async () => {
    if (student === null) return;

    setWithdrawing(true);
    try {
      // Returns the updated row: Status='Withdrawn', Withdrawal_Date=today.
      setStudent(await withdrawStudent(student.Student_ID));
      setConfirmOpen(false);
      addToast('success', 'Student withdrawn');
    } catch (err) {
      addToast('error', getThrownErrorMessage(err, 'Unable to withdraw this student.'));
    } finally {
      setWithdrawing(false);
    }
  };

  const backToStudents = (
    <button
      type="button"
      onClick={() => navigate('/students')}
      className="text-sm font-medium text-primary hover:underline"
    >
      ← Back to students
    </button>
  );

  if (loading) {
    return <LoadingState message="Loading student..." />;
  }

  if (error !== null || student === null) {
    const notFound = errorCode === 'NOT_FOUND';
    return (
      <div className="space-y-4">
        {backToStudents}
        <div className="card p-6">
          <ErrorState
            title={notFound ? 'Student not found' : 'Unable to load student'}
            message={error ?? 'Student not found.'}
            retry={notFound ? undefined : () => void load()}
          />
        </div>
      </div>
    );
  }

  const fullName = [student.First_Name, student.Last_Name].filter(Boolean).join(' ');

  return (
    <div className="space-y-6">
      {backToStudents}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              {fullName || student.Student_ID}
            </h1>
            <StatusBadge
              label={student.Status || 'Unknown'}
              variant={getStatusVariant(student.Status || '')}
            />
          </div>
          <p className="text-gray-500 mt-1">Student ID: {student.Student_ID}</p>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => navigate('/students/' + student.Student_ID + '/edit')}
            >
              Edit
            </Button>
          )}
          {canWithdraw && !isWithdrawn && (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Withdraw
            </Button>
          )}
        </div>
      </div>

      <Card padding="none">
        <CardHeader title="Student details" />
        <CardBody>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DetailItem label="Student ID" value={student.Student_ID} />
            <DetailItem label="First name" value={student.First_Name} />
            <DetailItem label="Last name" value={student.Last_Name} />
            <DetailItem label="Gender" value={student.Gender} />
            <DetailItem label="Date of birth" value={student.Date_of_Birth} />
            <DetailItem label="Class" value={student.Class} />
            <DetailItem label="Admission date" value={student.Admission_Date} />
            <DetailItem label="Status" value={student.Status} />
            <DetailItem label="Withdrawal date" value={student.Withdrawal_Date} />
          </dl>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Parent / guardian" />
        <CardBody>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DetailItem label="Parent / guardian" value={student.Parent_Guardian} />
            <DetailItem label="Guardian phone" value={student.Guardian_Phone} />
            <DetailItem label="Guardian email" value={student.Guardian_Email} />
          </dl>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Emergency contacts" />
        <CardBody>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <DetailItem label="Contact 1 name" value={student.Emergency_Contact_1_Name} />
            <DetailItem label="Contact 1 phone" value={student.Emergency_Contact_1_Phone} />
            <DetailItem
              label="Contact 1 relationship"
              value={student.Emergency_Contact_1_Relationship}
            />
            <DetailItem label="Contact 2 name" value={student.Emergency_Contact_2_Name} />
            <DetailItem label="Contact 2 phone" value={student.Emergency_Contact_2_Phone} />
            <DetailItem
              label="Contact 2 relationship"
              value={student.Emergency_Contact_2_Relationship}
            />
          </dl>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Medical and notes" />
        <CardBody className="space-y-6">
          <dl className="grid grid-cols-1 gap-6">
            <DetailItem label="Allergies" value={student.Allergies} />
            <DetailItem
              label="Illnesses / medical conditions"
              value={student.Illnesses_Medical_Conditions}
            />
            <DetailItem
              label="Physical defects / special conditions"
              value={student.Physical_Defects_Special_Conditions}
            />
            <DetailItem label="Notes" value={student.Notes} />
          </dl>
        </CardBody>
      </Card>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleWithdraw()}
        title="Withdraw student"
        message={
          'This will set ' +
          (fullName || student.Student_ID) +
          ' to Withdrawn and record today as the withdrawal date. ' +
          'The record itself is kept for historical reporting.'
        }
        confirmLabel="Withdraw student"
        cancelLabel="Cancel"
        variant="danger"
        loading={withdrawing}
      />
    </div>
  );
}

export default StudentDetail;

