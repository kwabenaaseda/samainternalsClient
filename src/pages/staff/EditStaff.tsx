/**
 * EditStaff
 *
 * The staff edit flow, against the existing `staff.update` action (Staff.js).
 *
 *   staff.get    -> success(record)   requires STAFF.READ
 *   staff.update -> success(record)   requires STAFF.UPDATE
 *
 * Staff_ID is PRESERVED: it is read from the route, used to load the record, and
 * echoed back only as the row identifier. handleStaffUpdate_ deletes it from the
 * patch before writing, so it can never change.
 *
 * ONLY CHANGED FIELDS ARE SENT. `buildUpdatePayload` diffs the form against the
 * loaded record, so an untouched column is never rewritten with a value the user
 * did not edit (Staff.js merges the patch over the stored row). If nothing
 * changed, no request is made at all.
 *
 * Employment_Status is deliberately not editable here: status transitions have
 * exactly one path, `staff.deactivate` on the list page.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStaff, updateStaff } from '../../api/staff';
import { getThrownErrorCode, getThrownErrorMessage } from '../../api/response';
import { Button, Card, CardBody, ErrorState, LoadingState } from '../../components/ui';
import { useToast } from '../../contexts';
import { usePermissions } from '../../hooks';
import type { PermissionCode, Staff } from '../../types';
import {
  StaffForm,
  buildUpdatePayload,
  staffErrorToFormState,
  staffToFormValues,
} from './StaffForm';
import type { StaffFormErrors, StaffFormValues } from './StaffForm';

/** Module-level so the array identity is stable across renders. */
const PAGE_PERMISSIONS: PermissionCode[] = ['STAFF.UPDATE'];

export function EditStaff() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canUpdate = permissions.get('STAFF.UPDATE') === true;

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<StaffFormErrors>({});
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (id === '') {
      setStaff(null);
      setLoading(false);
      setError('No staff member was specified in the address.');
      setErrorCode('VALIDATION_ERROR');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode('');
    try {
      setStaff(await getStaff(id));
    } catch (err) {
      setStaff(null);
      setError(getThrownErrorMessage(err, 'Unable to load this staff member.'));
      setErrorCode(getThrownErrorCode(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (values: StaffFormValues) => {
    if (staff === null) return;

    const payload = buildUpdatePayload(values, staff);
    const changedFields = Object.keys(payload).filter((key) => key !== 'Staff_ID');
    if (changedFields.length === 0) {
      // Never send a no-op update over an unchanged record.
      addToast('info', 'No changes to save.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    setFieldErrors({});
    try {
      await updateStaff(payload);
      addToast('success', 'Staff ' + staff.Staff_ID + ' updated.');
      navigate('/staff');
    } catch (err) {
      const state = staffErrorToFormState(err, 'Unable to update this staff member.');
      setFieldErrors(state.fieldErrors);
      setFormError(state.formError);
      addToast('error', getThrownErrorMessage(err, 'Unable to update this staff member.'));
    } finally {
      setSubmitting(false);
    }
  };

  const backToStaff = (
    <button
      type="button"
      onClick={() => navigate('/staff')}
      className="text-sm font-medium text-primary hover:underline"
    >
      ← Back to staff
    </button>
  );

  if (loading) {
    return <LoadingState message="Loading staff member..." />;
  }

  if (error !== null || staff === null) {
    const notFound = errorCode === 'NOT_FOUND';
    return (
      <div className="space-y-4">
        {backToStaff}
        <div className="card p-6">
          <ErrorState
            title={notFound ? 'Staff member not found' : 'Unable to load staff member'}
            message={error ?? 'Staff member not found.'}
            retry={notFound ? undefined : () => void load()}
          />
        </div>
      </div>
    );
  }

  const fullName = [staff.First_Name, staff.Last_Name].filter(Boolean).join(' ');

  if (canUpdate === false) {
    return (
      <div className="space-y-4">
        {backToStaff}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Edit Staff</h1>
          <p className="text-gray-500 mt-1">Permission required</p>
        </div>
        <Card>
          <CardBody>
            <p className="text-gray-500">
              You do not have permission to edit staff records.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!canUpdate) {
    return <LoadingState message="Checking access..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {fullName || staff.Staff_ID}
          </h1>
          <p className="text-gray-500 mt-1">
            Edit staff details · Staff ID: {staff.Staff_ID}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/staff')}>
          Back to Staff
        </Button>
      </div>

      <StaffForm
        initialValues={staffToFormValues(staff)}
        staffId={staff.Staff_ID}
        submitLabel="Save Changes"
        submitting={submitting}
        formError={formError}
        fieldErrors={fieldErrors}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/staff')}
      />
    </div>
  );
}

export default EditStaff;

