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

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExpenses = async () => {
    try {
      const data = await apiFetch('/expenses', { token });
      setExpenses(data.expenses || []);
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
      fetchExpenses();
    }, [token])
  );

  const deleteExpense = (id: string) => {
    Alert.alert(s('confirm_delete'), '', [
      { text: s('no'), style: 'cancel' },
      {
        text: s('yes'),
        style: 'destructive',
        onPress: async () => {
          await apiFetch(`/expenses/${id}`, { method: 'DELETE', token });
          fetchExpenses();
        },
      },
    ]);
  };

  // Group expenses by date
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

      {expenses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{s('no_expenses')}</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchExpenses(); }} tintColor={colors.statusAman} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <Text style={[styles.groupDate, { color: colors.textSecondary }]}>{group.date}</Text>
              {group.items.map((exp) => (
                <View
                  key={exp.expense_id}
                  testID={`expense-item-${exp.expense_id}`}
                  style={[
                    styles.expenseItem,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      shadowColor: colors.shadow,
                    },
                  ]}
                >
                  <View style={styles.expenseInfo}>
                    <Text style={[styles.expenseAmount, { color: colors.text }]}>{formatRupiah(exp.amount)}</Text>
                    {exp.note ? <Text style={[styles.expenseNote, { color: colors.textSecondary }]}>{exp.note}</Text> : null}
                    <Text style={[styles.expenseTime, { color: colors.textSecondary }]}>{formatTime(exp.created_at)}</Text>
                  </View>
                  <TouchableOpacity
                    testID={`delete-expense-${exp.expense_id}`}
                    style={[styles.deleteBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border }]}
                    onPress={() => deleteExpense(exp.expense_id)}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  group: { marginBottom: 16 },
  groupDate: { fontSize: 13, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  expenseInfo: { flex: 1 },
  expenseAmount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  expenseNote: { fontSize: 13, marginTop: 2 },
  expenseTime: { fontSize: 12, marginTop: 4 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
});
