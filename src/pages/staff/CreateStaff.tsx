/**
 * CreateStaff
 *
 * The "Add Staff" flow, against the existing `staff.create` action (Staff.js).
 * No new endpoints are introduced and no new fields are invented:
 *
 *   staff.create -> success(created)   requires STAFF.CREATE
 *
 * CONTRACT
 *   Required: First_Name, Last_Name, Email, Position, Employment_Date
 *             (REQUIRED_STAFF_FIELDS). Everything else is optional.
 *   Staff_ID is server-generated (generateId_('STF')) and is deliberately never
 *   sent — handleStaffCreate_ rejects a client-supplied value with
 *   VALIDATION_ERROR.
 *   Employment_Status defaults to 'Active' server-side.
 *   Salary_Amount must be a non-negative number; Salary_Frequency must be one of
 *   CONFIG.VALUES.SALARY_FREQUENCY.
 *
 * Validation errors are shown field-by-field; the backend remains the authority
 * and its VALIDATION_ERROR details are merged into the same field slots.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStaff } from '../../api/staff';
import { getThrownErrorMessage } from '../../api/response';
import { Button, Card, CardBody, LoadingState } from '../../components/ui';
import { useToast } from '../../contexts';
import { usePermissions } from '../../hooks';
import type { PermissionCode } from '../../types';
import {
  StaffForm,
  EMPTY_STAFF_FORM,
  formValuesToCreatePayload,
  staffErrorToFormState,
} from './StaffForm';
import type { StaffFormErrors, StaffFormValues } from './StaffForm';

/** Module-level so the array identity is stable across renders. */
const PAGE_PERMISSIONS: PermissionCode[] = ['STAFF.CREATE'];

export function CreateStaff() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const permissions = usePermissions(PAGE_PERMISSIONS);
  const canCreate = permissions.get('STAFF.CREATE') === true;

  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<StaffFormErrors>({});
  const [formError, setFormError] = useState('');

  const handleSubmit = async (values: StaffFormValues) => {
    setSubmitting(true);
    setFormError('');
    setFieldErrors({});
    try {
      const created = await createStaff(formValuesToCreatePayload(values));
      addToast('success', 'Staff ' + created.Staff_ID + ' created.');
      navigate('/staff');
    } catch (err) {
      const state = staffErrorToFormState(err, 'Unable to create this staff member.');
      setFieldErrors(state.fieldErrors);
      setFormError(state.formError);
      addToast('error', getThrownErrorMessage(err, 'Unable to create this staff member.'));
    } finally {
      setSubmitting(false);
    }
  };

  // The route guard resolves STAFF.CREATE before this page mounts; these states
  // only cover the brief window before that check lands (or a direct API-level
  // refusal, e.g. a navigation that bypassed the router).
  if (canCreate === false) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add Staff</h1>
          <p className="text-gray-500 mt-1">Permission required</p>
        </div>
        <Card>
          <CardBody>
            <p className="text-gray-500">
              You do not have permission to add staff members.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!canCreate) {
    return <LoadingState message="Checking access..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Add Staff</h1>
          <p className="text-gray-500 mt-1">
            Create a staff record. Required fields must be filled in.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => navigate('/staff')}>
          Back to Staff
        </Button>
      </div>

      <StaffForm
        initialValues={EMPTY_STAFF_FORM}
        submitLabel="Create Staff"
        submitting={submitting}
        formError={formError}
        fieldErrors={fieldErrors}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/staff')}
      />
    </div>
  );
}

export default CreateStaff;

