import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import DatePickerField, { toDateInputValue } from '@/src/components/DatePickerField';
import { apiFetchWithAuth, getDataMutationRevision } from '@/src/utils/api';

type Expense = { expense_id: string; amount: number; note: string; created_at: string; expense_date?: string; budget_id: string };
type BudgetPot = { budget_id: string; label: string; category: string; icon: string };

function formatRupiah(n: number): string {
  return `Rp${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function formatInputDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - ' + formatTime(iso);
}
function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return lang === 'id' ? 'Hari Ini' : 'Today';
  if (d.toDateString() === yesterday.toDateString()) return lang === 'id' ? 'Kemarin' : 'Yesterday';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
function toExpenseDateInput(exp: Expense): string {
  const raw = exp.expense_date || exp.created_at;
  if (!raw) return toDateInputValue(new Date());
  return raw.slice(0, 10);
}
function formatInputDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}
function parseFormattedNumber(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, ''), 10) || 0;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { colors } = useTheme();
  const { s, lang } = useLanguage();
  const selectedBudgetIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const lastLoadedRevisionRef = useRef(-1);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<BudgetPot[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState(toDateInputValue(new Date()));
  const [editSaving, setEditSaving] = useState(false);

  const fetchData = async (budgetOverride?: string | null) => {
    try {
      const budgetId = budgetOverride !== undefined ? budgetOverride : selectedBudgetIdRef.current;
      const [expData, budData] = await Promise.all([
        apiFetchWithAuth(budgetId ? `/expenses?budget_id=${budgetId}` : '/expenses', { token }),
        apiFetchWithAuth('/budgets', { token }),
      ]);
      setExpenses(expData.expenses || []);
      setBudgets(budData.budgets || []);
    } catch (e) {
      console.error(e);
    } finally {
      hasLoadedRef.current = true;
      lastLoadedRevisionRef.current = getDataMutationRevision();
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const revision = getDataMutationRevision();
      if (!hasLoadedRef.current) {
        setLoading(true);
        setSelectedIds(new Set());
        fetchData();
      } else if (lastLoadedRevisionRef.current !== revision) {
        setSelectedIds(new Set());
        fetchData();
      }
    }, [token])
  );

  const selectBudget = (budgetId: string | null) => {
    selectedBudgetIdRef.current = budgetId;
    setSelectedBudgetId(budgetId);
    setLoading(true);
    setSelectedIds(new Set());
    fetchData(budgetId);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === expenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expenses.map((e) => e.expense_id)));
    }
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const msg = lang === 'id' ? `Hapus ${count} pengeluaran?` : `Delete ${count} expenses?`;
    Alert.alert(s('confirm_delete'), msg, [
      { text: s('no'), style: 'cancel' },
      {
        text: s('yes'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          await apiFetchWithAuth('/expenses/bulk-delete', {
            method: 'POST',
            token,
            body: { expense_ids: Array.from(selectedIds) },
          });
          setSelectedIds(new Set());
          setDeleting(false);
          fetchData();
        },
      },
    ]);
  };

  const deleteSingle = (id: string) => {
    Alert.alert(s('confirm_delete'), '', [
      { text: s('no'), style: 'cancel' },
      {
        text: s('yes'),
        style: 'destructive',
        onPress: async () => {
          await apiFetchWithAuth(`/expenses/${id}`, { method: 'DELETE', token });
          fetchData();
        },
      },
    ]);
  };

  const openEdit = (exp: Expense) => {
    setEditExpense(exp);
    setEditAmount(formatInputDisplay(String(exp.amount)));
    setEditNote(exp.note || '');
    setEditDate(toExpenseDateInput(exp));
  };

  const saveEdit = async () => {
    if (!editExpense) return;
    const amount = parseFormattedNumber(editAmount);
    if (amount <= 0) {
      Alert.alert('Error', 'Invalid amount');
      return;
    }
    setEditSaving(true);
    Keyboard.dismiss();
    const res = await apiFetchWithAuth(`/expenses/${editExpense.expense_id}`, {
      method: 'PATCH',
      token,
      body: { amount, note: editNote, expense_date: editDate },
    });
    if (res.error) {
      Alert.alert('Error', res.error);
    } else {
      setEditExpense(null);
      fetchData();
    }
    setEditSaving(false);
  };

  const getBudgetLabel = (budgetId: string) => budgets.find((p) => p.budget_id === budgetId)?.label || '';

  // Group by date for SectionList
  const sections: { title: string; data: Expense[] }[] = [];
  expenses.forEach((exp) => {
    const dateKey = formatDate(exp.expense_date || exp.created_at, lang);
    const existing = sections.find((s) => s.title === dateKey);
    if (existing) existing.data.push(exp);
    else sections.push({ title: dateKey, data: [exp] });
  });

  const allSelected = expenses.length > 0 && selectedIds.size === expenses.length;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.statusAman} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]} testID="history-screen">
      <Text style={[styles.title, { color: colors.text }]}>{s('history')}</Text>

      {/* Budget filter - FIXED HEIGHT pills */}
      {budgets.length > 0 && (
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              testID="filter-all"
              style={[styles.filterPill, { backgroundColor: !selectedBudgetId ? colors.statusAman : colors.card, borderColor: colors.border }]}
              onPress={() => selectBudget(null)}
            >
              <Text style={[styles.filterPillText, { color: !selectedBudgetId ? '#111' : colors.text }]}>{s('all_budgets')}</Text>
            </TouchableOpacity>
            {budgets.map((b) => {
              const active = selectedBudgetId === b.budget_id;
              return (
                <TouchableOpacity
                  key={b.budget_id}
                  testID={`filter-${b.budget_id}`}
                  style={[styles.filterPill, { backgroundColor: active ? colors.statusAman : colors.card, borderColor: colors.border }]}
                  onPress={() => selectBudget(b.budget_id)}
                >
                  <Text style={[styles.filterPillText, { color: active ? '#111' : colors.text }]}>{b.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Select all + Delete selected bar */}
      {expenses.length > 0 && (
        <View style={[styles.actionBar, { borderColor: colors.border }]}>
          <TouchableOpacity testID="select-all-btn" style={styles.selectAllRow} onPress={toggleSelectAll}>
            <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: allSelected ? colors.statusAman : 'transparent' }]}>
              {allSelected && <Ionicons name="checkmark" size={14} color="#111" />}
            </View>
            <Text style={[styles.selectAllText, { color: colors.textSecondary }]}>
              {allSelected ? (lang === 'id' ? 'Batal Pilih' : 'Deselect All') : (lang === 'id' ? 'Pilih Semua' : 'Select All')}
            </Text>
          </TouchableOpacity>
          {selectedIds.size > 0 && (
            <TouchableOpacity
              testID="bulk-delete-btn"
              style={[styles.bulkDeleteBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border }]}
              onPress={deleteSelected}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text style={styles.bulkDeleteText}>
                    {lang === 'id' ? `Hapus (${selectedIds.size})` : `Delete (${selectedIds.size})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{s('no_expenses')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.expense_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.statusAman} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.groupDate, { color: colors.textSecondary }]}>{section.title}</Text>
          )}
          renderItem={({ item: exp }) => {
            const isChecked = selectedIds.has(exp.expense_id);
            return (
              <View
                testID={`expense-item-${exp.expense_id}`}
                style={[styles.expenseItem, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
              >
                {/* Checkbox */}
                <TouchableOpacity
                  testID={`checkbox-${exp.expense_id}`}
                  style={[styles.checkbox, { borderColor: colors.border, backgroundColor: isChecked ? colors.statusAman : 'transparent' }]}
                  onPress={() => toggleSelect(exp.expense_id)}
                >
                  {isChecked && <Ionicons name="checkmark" size={14} color="#111" />}
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.expenseInfo}>
                  <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatRupiah(exp.amount)}</Text>
                  {exp.note ? <Text style={[styles.expenseNote, { color: colors.textSecondary }]} numberOfLines={1}>{exp.note}</Text> : null}
                  <View style={styles.expenseMeta}>
                    <Text style={[styles.expenseBudget, { color: colors.textSecondary }]}>{getBudgetLabel(exp.budget_id)}</Text>
                    <Text style={[styles.expenseTime, { color: colors.textSecondary }]}>
                      {lang === 'id' ? 'Diinput' : 'Input'}: {formatInputDateTime(exp.created_at)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  testID={`edit-expense-${exp.expense_id}`}
                  onPress={() => openEdit(exp)}
                  style={styles.xDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* X delete icon */}
                <TouchableOpacity
                  testID={`delete-expense-${exp.expense_id}`}
                  onPress={() => deleteSingle(exp.expense_id)}
                  style={styles.xDeleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color={colors.statusBoncos} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!editExpense} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} onPress={() => { setEditExpense(null); Keyboard.dismiss(); }} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{lang === 'id' ? 'Edit Pengeluaran' : 'Edit Expense'}</Text>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('expense_date')}</Text>
            <DatePickerField
              testID="edit-expense-date-input"
              value={editDate}
              onChange={setEditDate}
              colors={colors}
              todayLabel={s('today')}
              doneLabel={lang === 'id' ? 'Selesai' : 'Done'}
            />
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('amount')}</Text>
            <View style={[styles.amountRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.amountPrefix, { color: colors.textSecondary }]}>Rp</Text>
              <TextInput
                testID="edit-expense-amount-input"
                style={[styles.amountInput, { color: colors.text }]}
                keyboardType="numeric"
                value={editAmount}
                onChangeText={(text) => setEditAmount(formatInputDisplay(text))}
              />
            </View>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{lang === 'id' ? 'Catatan' : 'Note'}</Text>
            <TextInput
              testID="edit-expense-note-input"
              style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={s('note_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={editNote}
              onChangeText={setEditNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditExpense(null)}>
                <Text style={[styles.cancelText, { color: colors.text }]}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="save-expense-edit-btn"
                style={[styles.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border }]}
                onPress={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.saveText}>{s('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },

  // Fixed filter pills
  filterWrap: { height: 44, marginBottom: 8 },
  filterRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
  },
  filterPillText: { fontSize: 13, fontWeight: '700' },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 4,
  },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { fontSize: 13, fontWeight: '600' },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
  },
  bulkDeleteText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },

  groupDate: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  expenseInfo: { flex: 1 },
  expenseAmount: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  expenseNote: { fontSize: 13, marginTop: 1 },
  expenseMeta: { gap: 2, marginTop: 3 },
  expenseBudget: { fontSize: 11, fontWeight: '600' },
  expenseTime: { fontSize: 11 },
  xDeleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 3, borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  amountPrefix: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 14 },
  noteInput: { fontSize: 15, borderWidth: 2, borderRadius: 12, padding: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700' },
  saveBtn: { flex: 1, borderWidth: 3, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#111' },
});
