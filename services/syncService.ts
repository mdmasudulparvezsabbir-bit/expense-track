
import { AppState } from "../types";

export const syncService = {
  syncToSheets: async (url: string, state: AppState): Promise<boolean> => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requires no-cors for simple redirects or handled via specific headers
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: state.transactions,
          users: state.users.map(u => ({ id: u.id, username: u.username, role: u.role })),
          timestamp: new Date().toISOString()
        }),
      });
      // Since mode is 'no-cors', we can't read the response body, 
      // but we assume success if no error is thrown.
      return true;
    } catch (error) {
      console.error("Sync Error:", error);
      return false;
    }
  }
};
