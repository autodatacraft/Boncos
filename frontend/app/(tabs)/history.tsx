import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetch } from '@/src/utils/api';

type Expense = {
  expense_id: string;
  amount: number;
  note: string;
  created_at: string;
  budget_id: string;
};

type BudgetPot = {
  budget_id: string;
  label: string;
  category: string;
  icon: string;
};

function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp${formatted}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [expData, budData] = await Promise.all([
        apiFetch(selectedBudgetId ? `/expenses?budget_id=${selectedBudgetId}` : '/expenses', { token }),
        apiFetch('/budgets', { token }),
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
      fetchData();
    }, [token, selectedBudgetId])
  );

  const deleteExpense = (id: string) => {
    Alert.alert(s('confirm_delete'), '', [
      { text: s('no'), style: 'cancel' },
      {
        text: s('yes'),
        style: 'destructive',
        onPress: async () => {
          await apiFetch(`/expenses/${id}`, { method: 'DELETE', token });
          fetchData();
        },
      },
    ]);
  };

  const getBudgetLabel = (budgetId: string) => {
    const b = budgets.find((p) => p.budget_id === budgetId);
    return b?.label || '';
  };

  const getBudgetIcon = (budgetId: string) => {
    const b = budgets.find((p) => p.budget_id === budgetId);
    return (b?.icon || 'wallet') as any;
  };

  // Group by date
  const grouped: { date: string; items: Expense[] }[] = [];
  expenses.forEach((exp) => {
    const dateKey = formatDate(exp.created_at, lang);
    const existing = grouped.find((g) => g.date === dateKey);
    if (existing) existing.items.push(exp);
    else grouped.push({ date: dateKey, items: [exp] });
  });

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

      {/* Budget filter */}
      {budgets.length > 1 && (
        <ScrollFilterRow
          budgets={budgets}
          selected={selectedBudgetId}
          onSelect={(id) => { setSelectedBudgetId(id); setLoading(true); }}
          colors={colors}
          s={s}
        />
      )}

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{s('no_expenses')}</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.statusAman} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <Text style={[styles.groupDate, { color: colors.textSecondary }]}>{group.date}</Text>
              {group.items.map((exp) => (
                <View
                  key={exp.expense_id}
                  testID={`expense-item-${exp.expense_id}`}
                  style={[styles.expenseItem, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
                >
                  <View style={[styles.expenseIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Ionicons name={getBudgetIcon(exp.budget_id)} size={16} color={colors.text} />
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatRupiah(exp.amount)}</Text>
                    {exp.note ? <Text style={[styles.expenseNote, { color: colors.textSecondary }]} numberOfLines={1}>{exp.note}</Text> : null}
                    <View style={styles.expenseMeta}>
                      <Text style={[styles.expenseBudget, { color: colors.textSecondary }]}>{getBudgetLabel(exp.budget_id)}</Text>
                      <Text style={[styles.expenseTime, { color: colors.textSecondary }]}>{formatTime(exp.created_at)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    testID={`delete-expense-${exp.expense_id}`}
                    style={[styles.deleteBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border }]}
                    onPress={() => deleteExpense(exp.expense_id)}
                  >
                    <Ionicons name="trash" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

// Budget filter chips
import { ScrollView } from 'react-native';

function ScrollFilterRow({ budgets, selected, onSelect, colors, s }: {
  budgets: BudgetPot[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  colors: any;
  s: (k: string) => string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
      <TouchableOpacity
        style={[styles.filterChip, { backgroundColor: !selected ? colors.statusAman : colors.card, borderColor: colors.border }]}
        onPress={() => onSelect(null)}
      >
        <Text style={[styles.filterChipText, { color: !selected ? '#111' : colors.text }]}>{s('all_budgets')}</Text>
      </TouchableOpacity>
      {budgets.map((b) => (
        <TouchableOpacity
          key={b.budget_id}
          style={[styles.filterChip, { backgroundColor: selected === b.budget_id ? colors.statusAman : colors.card, borderColor: colors.border }]}
          onPress={() => onSelect(b.budget_id)}
        >
          <Ionicons name={(b.icon || 'wallet') as any} size={14} color={selected === b.budget_id ? '#111' : colors.text} />
          <Text style={[styles.filterChipText, { color: selected === b.budget_id ? '#111' : colors.text }]}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },

  // Filter
  filterScroll: { paddingHorizontal: 20, marginBottom: 12 },
  filterContent: { gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 2,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },

  group: { marginBottom: 16 },
  groupDate: { fontSize: 13, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
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
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  expenseInfo: { flex: 1 },
  expenseAmount: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },
  expenseNote: { fontSize: 13, marginTop: 1 },
  expenseMeta: { flexDirection: 'row', gap: 8, marginTop: 3 },
  expenseBudget: { fontSize: 11, fontWeight: '600' },
  expenseTime: { fontSize: 11 },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
