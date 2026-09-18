// Student Types
// Based on Students.js schema

export type StudentStatus = 'Active' | 'Withdrawn' | 'Graduated' | 'Suspended';

export interface Student {
  Student_ID: string;
  First_Name: string;
  Last_Name: string;
  Gender?: string;
  Date_of_Birth?: string;
  Class?: string;
  Parent_Guardian?: string;
  Guardian_Phone?: string;
  Guardian_Email?: string;
  Emergency_Contact_1_Name?: string;
  Emergency_Contact_1_Phone?: string;
  Emergency_Contact_1_Relationship?: string;
  Emergency_Contact_2_Name?: string;
  Emergency_Contact_2_Phone?: string;
  Emergency_Contact_2_Relationship?: string;
  Allergies?: string;
  Illnesses_Medical_Conditions?: string;
  Physical_Defects_Special_Conditions?: string;
  Admission_Date?: string;
  Status: StudentStatus;
  Withdrawal_Date?: string;
  Notes?: string;
}

export interface CreateStudentPayload {
  First_Name: string;
  Last_Name: string;
  Class: string;
  Admission_Date: string;
  Parent_Guardian: string;
  Gender?: string;
  Date_of_Birth?: string;
  Guardian_Phone?: string;
  Guardian_Email?: string;
  Emergency_Contact_1_Name?: string;
  Emergency_Contact_1_Phone?: string;
  Emergency_Contact_1_Relationship?: string;
  Emergency_Contact_2_Name?: string;
  Emergency_Contact_2_Phone?: string;
  Emergency_Contact_2_Relationship?: string;
  Allergies?: string;
  Illnesses_Medical_Conditions?: string;
  Physical_Defects_Special_Conditions?: string;
  Notes?: string;
}

export interface UpdateStudentPayload {
  Student_ID: string;
  First_Name?: string;
  Last_Name?: string;
  Gender?: string;
  Date_of_Birth?: string;
  Class?: string;
  Parent_Guardian?: string;
  Guardian_Phone?: string;
  Guardian_Email?: string;
  Emergency_Contact_1_Name?: string;
  Emergency_Contact_1_Phone?: string;
  Emergency_Contact_1_Relationship?: string;
  Emergency_Contact_2_Name?: string;
  Emergency_Contact_2_Phone?: string;
  Emergency_Contact_2_Relationship?: string;
  Allergies?: string;
  Illnesses_Medical_Conditions?: string;
  Physical_Defects_Special_Conditions?: string;
  Admission_Date?: string;
  Status?: StudentStatus;
  Notes?: string;
}
