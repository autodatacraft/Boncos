export type Language = 'id' | 'en';

type Translations = Record<string, Record<Language, string>>;

export const t: Translations = {
  // Login
  app_name: { id: 'Boncos', en: 'Boncos' },
  tagline: { id: 'Hari ini gue masih aman spend berapa?', en: 'How much can I safely spend today?' },
  login_google: { id: 'Masuk dengan Google', en: 'Sign in with Google' },
  
  // Dashboard
  daily_allowance: { id: 'Jatah Hari Ini', en: "Today's Allowance" },
  today_spent: { id: 'Sudah Keluar', en: 'Spent Today' },
  today_remaining: { id: 'Sisa Aman', en: 'Safe to Spend' },
  remaining_balance: { id: 'Sisa Saldo', en: 'Remaining Balance' },
  days_left: { id: 'Hari Menuju Refill', en: 'Days to Refill' },
  total_spent: { id: 'Total Keluar', en: 'Total Spent' },
  
  // Health status
  aman: { id: 'Aman', en: 'Safe' },
  agak_panas: { id: 'Agak Panas', en: 'Getting Warm' },
  rem_dikit: { id: 'Rem Dikit Bos', en: 'Slow Down!' },
  boncos: { id: 'Boncos Total', en: 'Broke!' },
  
  // Expense input
  add_expense: { id: 'Catat Pengeluaran', en: 'Log Expense' },
  amount: { id: 'Nominal', en: 'Amount' },
  note_placeholder: { id: 'Catatan (opsional)', en: 'Note (optional)' },
  save: { id: 'Simpan', en: 'Save' },
  cancel: { id: 'Batal', en: 'Cancel' },
  
  // History
  history: { id: 'Riwayat', en: 'History' },
  no_expenses: { id: 'Belum ada pengeluaran', en: 'No expenses yet' },
  delete: { id: 'Hapus', en: 'Delete' },
  
  // Settings
  settings: { id: 'Pengaturan', en: 'Settings' },
  budget_setup: { id: 'Atur Budget', en: 'Budget Setup' },
  total_balance: { id: 'Total Saldo', en: 'Total Balance' },
  refill_date: { id: 'Tanggal Refill / Gajian', en: 'Refill / Payday Date' },
  budget_label: { id: 'Label Budget', en: 'Budget Label' },
  save_budget: { id: 'Simpan Budget', en: 'Save Budget' },
  language: { id: 'Bahasa', en: 'Language' },
  theme: { id: 'Tema', en: 'Theme' },
  dark_mode: { id: 'Mode Gelap', en: 'Dark Mode' },
  light_mode: { id: 'Mode Terang', en: 'Light Mode' },
  logout: { id: 'Keluar', en: 'Logout' },
  no_budget: { id: 'Belum ada budget. Atur dulu di Settings!', en: 'No budget yet. Set up in Settings!' },
  
  // Tabs
  tab_home: { id: 'Beranda', en: 'Home' },
  tab_history: { id: 'Riwayat', en: 'History' },
  tab_settings: { id: 'Pengaturan', en: 'Settings' },

  // Quick input
  quick_input: { id: 'Input Cepat', en: 'Quick Input' },
  custom_amount: { id: 'Nominal Lain', en: 'Custom Amount' },
  
  // Misc
  welcome: { id: 'Halo', en: 'Hello' },
  today: { id: 'Hari Ini', en: 'Today' },
  yesterday: { id: 'Kemarin', en: 'Yesterday' },
  confirm_delete: { id: 'Yakin hapus?', en: 'Confirm delete?' },
  yes: { id: 'Ya', en: 'Yes' },
  no: { id: 'Tidak', en: 'No' },
  budget_saved: { id: 'Budget tersimpan!', en: 'Budget saved!' },
  expense_saved: { id: 'Pengeluaran tercatat!', en: 'Expense logged!' },
};
