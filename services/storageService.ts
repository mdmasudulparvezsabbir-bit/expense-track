
import { AppState, UserRole } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';

const STORAGE_KEY = 'finvue_data_v2';

export const storageService = {
  saveData: (state: AppState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },

  loadData: (): AppState => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      // Create initial Admin user
      const initialAdmin = {
        id: 'admin_1',
        username: 'admin',
        password: 'admin',
        role: UserRole.ADMIN
      };
      return {
        transactions: [],
        categories: DEFAULT_CATEGORIES,
        users: [initialAdmin],
        currentUser: null,
        activityLogs: [],
        companyName: 'FinVue Enterprise',
        companyLogo: undefined,
        darkMode: false
      };
    }
    const parsed = JSON.parse(saved);
    // Migration for activityLogs
    if (!parsed.activityLogs) parsed.activityLogs = [];
    if (parsed.darkMode === undefined) parsed.darkMode = false;
    return parsed;
  },

  clearData: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
