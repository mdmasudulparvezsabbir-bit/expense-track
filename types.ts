
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  BILLING_EXECUTIVE = 'BILLING_EXECUTIVE',
  EMPLOYEE = 'EMPLOYEE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export type PaymentSource = 'Cash' | 'Bank' | 'Bkash' | 'Nagad';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  profilePic?: string; // Base64 image
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  details: string;
  type: 'auth' | 'transaction' | 'user' | 'system';
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  subCategory?: string;
  source: PaymentSource;
  date: string;
  note: string;
  userId: string;
  createdBy: string;
  status: TransactionStatus;
}

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  users: User[];
  currentUser: User | null;
  activityLogs: ActivityLog[];
  companyName?: string;
  companyLogo?: string; // Base64 image
  sheetUrl?: string; // Google Apps Script URL
  lastSynced?: string;
  darkMode?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  isCustom?: boolean;
}

export interface AISuggestion {
  tip: string;
  type: 'saving' | 'warning' | 'info';
}
