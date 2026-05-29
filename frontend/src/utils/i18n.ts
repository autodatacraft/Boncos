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
  input_amount: { id: 'Masukkan nominal', en: 'Enter amount' },
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
  no_budget: { id: 'Belum ada budget. Atur dulu di Pengaturan!', en: 'No budget yet. Set up in Settings!' },

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

  // Multi budget pot
  budget_pots: { id: 'Budget Pot', en: 'Budget Pots' },
  add_pot: { id: 'Tambah Pot', en: 'Add Pot' },
  category: { id: 'Kategori', en: 'Category' },
  select_budget: { id: 'Pilih Budget', en: 'Select Budget' },
  all_budgets: { id: 'Semua Budget', en: 'All Budgets' },
  no_pots: { id: 'Belum ada pot. Tambah di bawah!', en: 'No pots yet. Add one below!' },
  delete_pot: { id: 'Hapus pot ini?', en: 'Delete this pot?' },
  pot_deleted: { id: 'Pot dihapus', en: 'Pot deleted' },

  // Categories
  cat_makan: { id: 'Makan', en: 'Food' },
  cat_transport: { id: 'Transport', en: 'Transport' },
  cat_kopi: { id: 'Kopi/Jajan', en: 'Coffee/Snacks' },
  cat_entertainment: { id: 'Hiburan', en: 'Entertainment' },
  cat_belanja: { id: 'Belanja', en: 'Shopping' },
  cat_umum: { id: 'Umum', en: 'General' },

  // Streak
  streak: { id: 'Streak', en: 'Streak' },
  current_streak: { id: 'Streak Saat Ini', en: 'Current Streak' },
  longest_streak: { id: 'Streak Terlama', en: 'Longest Streak' },
  days: { id: 'hari', en: 'days' },
  today_logged: { id: 'Sudah input hari ini!', en: 'Logged today!' },
  not_logged_today: { id: 'Belum input hari ini', en: "Haven't logged today" },

  // Edit budget
  edit_budget: { id: 'Edit Budget', en: 'Edit Budget' },
  edit: { id: 'Edit', en: 'Edit' },
  budget_updated: { id: 'Budget diupdate!', en: 'Budget updated!' },
  new_total: { id: 'Total Saldo Baru', en: 'New Total Balance' },

  // Bulk delete
  delete_selected: { id: 'Hapus Terpilih', en: 'Delete Selected' },
  select_all: { id: 'Pilih Semua', en: 'Select All' },
  deselect_all: { id: 'Batal Pilih', en: 'Deselect All' },

  // Notifications
  reminder_title: { id: 'Boncos Reminder', en: 'Boncos Reminder' },
  reminder_body: { id: 'Belum input pengeluaran hari ini! Yuk catat biar ga boncos ', en: "You haven't logged expenses today! Log now to stay on budget " },

  // Refill
  budget_refilled: { id: 'Budget sudah di-refill! ', en: 'Budget refilled! ' },

  // Greetings
  good_morning: { id: 'Selamat Pagi', en: 'Good Morning' },
  good_afternoon: { id: 'Selamat Siang', en: 'Good Afternoon' },
  good_evening: { id: 'Selamat Malam', en: 'Good Evening' },

  // Contact
  contact_us: { id: 'Hubungi Kami', en: 'Contact Us' },
  contact_placeholder: { id: 'Tulis pesan kamu di sini...', en: 'Write your message here...' },
  send: { id: 'Kirim', en: 'Send' },
  close: { id: 'Tutup', en: 'Close' },
  message_sent: { id: 'Pesan terkirim! Terima kasih.', en: 'Message sent! Thank you.' },

  // Export
  export_csv: { id: 'Export ke CSV', en: 'Export to CSV' },
  export_v60_only: { id: 'Fitur khusus tier V60', en: 'V60 tier exclusive feature' },

  // Offline
  offline_warning: { id: '⚠️ Kamu sedang offline. Data akan sync saat online.', en: '⚠️ You are offline. Data will sync when online.' },

  // Subscription
  join_club: { id: 'Join Anti Boncos Club', en: 'Join Anti Boncos Club' },
  current_plan: { id: 'Plan Saat Ini', en: 'Current Plan' },
  upgrade: { id: 'Upgrade', en: 'Upgrade' },
  pot_locked: { id: 'Budget pot ini terkunci karena limit plan kamu.', en: 'This budget pot is locked due to your plan limit.' },
  pot_locked_cta: { id: 'Upgrade untuk buka akses penuh', en: 'Upgrade to unlock full access' },
  plan_free: { id: 'Free', en: 'Free' },
  plan_americano: { id: 'Americano', en: 'Americano' },
  plan_kopi_gula_aren: { id: 'Kopi Gula Aren', en: 'Kopi Gula Aren' },
  plan_v60: { id: 'V60', en: 'V60' },
  pot_limit_reached: { id: 'Limit pot tercapai! Upgrade untuk tambah.', en: 'Pot limit reached! Upgrade to add more.' },

  // Share
  share_streak: { id: 'Share Streak', en: 'Share Streak' },
  share_budget: { id: 'Bagikan Budget', en: 'Share Budget' },
  share_with_email: { id: 'Email teman', en: "Friend's email" },
  shared_with: { id: 'Dibagikan ke', en: 'Shared with' },
  shared_by: { id: 'Dari', en: 'From' },
  share_success: { id: 'Berhasil dibagikan!', en: 'Shared successfully!' },
  unshare: { id: 'Hapus akses', en: 'Remove access' },
};
