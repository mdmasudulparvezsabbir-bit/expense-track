
import * as XLSX from 'xlsx';
import { Transaction } from '../types';

export const exportToExcel = (transactions: Transaction[]) => {
  const data = transactions.map(t => ({
    Date: new Date(t.date).toLocaleDateString(),
    Type: t.type,
    Category: t.category,
    Amount: t.amount,
    Note: t.note
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  // Fix column widths
  const wscols = [
    { wch: 15 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `FinVue_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};
