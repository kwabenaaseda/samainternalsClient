// Permission Types
// Based on Permissions.js

export type PermissionCode =
  | 'STUDENTS.READ'
  | 'STUDENTS.CREATE'
  | 'STUDENTS.UPDATE'
  | 'STUDENTS.WITHDRAW'
  | 'STAFF.READ'
  | 'STAFF.CREATE'
  | 'STAFF.UPDATE'
  | 'STAFF.DEACTIVATE'
  | 'SCHOOL_FEES.READ'
  | 'SCHOOL_FEES.CREATE'
  | 'SCHOOL_FEES.UPDATE'
  | 'SCHOOL_FEES.VOID'
  | 'FEEDING_FEES.READ'
  | 'FEEDING_FEES.CREATE'
  | 'FEEDING_FEES.UPDATE'
  | 'FEEDING_FEES.VOID'
  | 'STATIONERY.READ'
  | 'STATIONERY.CREATE'
  | 'STATIONERY.FULFILL'
  | 'INVENTORY.READ'
  | 'INVENTORY.CREATE'
  | 'INVENTORY.ADJUST'
  | 'DASHBOARD.READ';

// Navigation Types
export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  href: string;
  permission?: PermissionCode;
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}
