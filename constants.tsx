
import { Category } from './types';
import { 
  Utensils, 
  Car, 
  Home, 
  ShoppingBag, 
  FileText, 
  Gamepad2, 
  Plus, 
  Wallet,
  Briefcase,
  TrendingUp,
  Gift,
  Globe,
  Link,
  ArrowUpCircle,
  Users,
  MapPin,
  ClipboardList,
  ShieldCheck,
  UserCheck,
  Zap,
  HardDrive
} from 'lucide-react';

export const CURRENCY = '৳';
export const PAYMENT_SOURCES = ['Cash', 'Bank', 'Bkash', 'Nagad'] as const;

export const CONVEYANCE_SUB_CATEGORIES = ['Oil', 'Bus', 'Rikshaw/Van'];
export const ADMIN_ASSET_SUB_CATEGORIES = ['Bonna', 'Ali Ahsan', 'Sumna', 'Kalamma/Ma'];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_requisition', name: 'Requisition', icon: 'ClipboardList', color: '#8b5cf6' },
  { id: 'cat_upstream', name: 'UPSTREAM BILL', icon: 'ArrowUpCircle', color: '#1e293b' },
  { id: 'cat_conveyance', name: 'Conveyance', icon: 'MapPin', color: '#f59e0b' },
  { id: 'cat_diss_kp', name: 'Diss-KP', icon: 'Zap', color: '#3b82f6' },
  { id: 'cat_diss_mojurdia', name: 'Diss-Mojurdia', icon: 'Zap', color: '#3b82f6' },
  { id: 'cat_diss_mohisala', name: 'Diss-Mohisala', icon: 'Zap', color: '#3b82f6' },
  { id: 'cat_diss_rupdia', name: 'Diss-Rupdia', icon: 'Zap', color: '#3b82f6' },
  { id: 'cat_food', name: 'Food', icon: 'Utensils', color: '#f43f5e' },
  { id: 'cat_transport', name: 'Transport', icon: 'Car', color: '#3b82f6' },
  { id: 'cat_rent', name: 'Rent', icon: 'Home', color: '#8b5cf6' },
  { id: 'cat_shopping', name: 'Shopping', icon: 'ShoppingBag', color: '#ec4899' },
  { id: 'cat_bills', name: 'Bills', icon: 'FileText', color: '#f59e0b' },
  { id: 'cat_ent', name: 'Entertainment', icon: 'Gamepad2', color: '#10b981' },
  { id: 'cat_other', name: 'Others', icon: 'Plus', color: '#64748b' },
];

export const ADMIN_ONLY_CATEGORIES: Category[] = [
  { id: 'cat_family', name: 'Family', icon: 'Users', color: '#ef4444' },
  { id: 'cat_marjan', name: 'Marjan', icon: 'ShieldCheck', color: '#8b5cf6' },
  { id: 'cat_admin_own', name: 'Admin Own', icon: 'UserCheck', color: '#1e293b' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'inc_agent', name: 'Agent Bill', icon: 'Users', color: '#8b5cf6' },
  { id: 'inc_abirlink', name: 'Abirlink Bill', icon: 'Link', color: '#0ea5e9' },
  { id: 'inc_gift', name: 'Gift', icon: 'Gift', color: '#f43f5e' },
  { id: 'inc_other', name: 'Other Income', icon: 'Wallet', color: '#64748b' },
];

export const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = {
    Utensils, Car, Home, ShoppingBag, FileText, Gamepad2, Plus, Wallet, Briefcase, TrendingUp, Gift, Globe, Link, ArrowUpCircle, Users, MapPin, ClipboardList, ShieldCheck, UserCheck, Zap, HardDrive
  };
  return icons[iconName] || Plus;
};
