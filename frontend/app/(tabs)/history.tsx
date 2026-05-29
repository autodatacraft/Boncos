import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetchWithAuth } from '@/src/utils/api';

type Expense = { expense_id: string; amount: number; note: string; created_at: string; budget_id: string };
type BudgetPot = { budget_id: string; label: string; category: string; icon: string };

function formatRupiah(n: number): string {
  return `Rp${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { colors } = useTheme();
  const { s, lang } = useLanguage();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<BudgetPot[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      const [expData, budData] = await Promise.all([
        apiFetchWithAuth(selectedBudgetId ? `/expenses?budget_id=${selectedBudgetId}` : '/expenses', { token }),
        apiFetchWithAuth('/budgets', { token }),
      ]);
      setExpenses(expData.expenses || []);
      setBudgets(budData.budgets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setSelectedIds(new Set());
      fetchData();
    }, [token, selectedBudgetId])
  );

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

  const getBudgetLabel = (budgetId: string) => budgets.find((p) => p.budget_id === budgetId)?.label || '';

  // Group by date for SectionList
  const sections: { title: string; data: Expense[] }[] = [];
  expenses.forEach((exp) => {
    const dateKey = formatDate(exp.created_at, lang);
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
              onPress={() => { setSelectedBudgetId(null); setLoading(true); }}
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
                  onPress={() => { setSelectedBudgetId(b.budget_id); setLoading(true); }}
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
                    <Text style={[styles.expenseTime, { color: colors.textSecondary }]}>{formatTime(exp.created_at)}</Text>
                  </View>
                </View>

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
  expenseMeta: { flexDirection: 'row', gap: 8, marginTop: 3 },
  expenseBudget: { fontSize: 11, fontWeight: '600' },
  expenseTime: { fontSize: 11 },
  xDeleteBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
