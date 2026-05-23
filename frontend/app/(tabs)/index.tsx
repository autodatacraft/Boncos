import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetch } from '@/src/utils/api';

type Dashboard = {
  budget_id: string;
  label: string;
  total_balance: number;
  current_balance: number;
  refill_date: string;
  days_remaining: number;
  daily_allowance: number;
  today_spent: number;
  today_remaining: number;
  health_status: string;
  total_spent: number;
};

const STATUS_IMAGES: Record<string, string> = {
  aman: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/ab4b7e50b1748300f9b350fe68960e7375287a6767468b28fdd160e2d398fb5a.png',
  agak_panas: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/07f1ebb03e94054a83f741777c2243c75283f19dd2f2c40276cec14c37a49c95.png',
  rem_dikit: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/011dc7c7846fdb1d4682cdfab02d93216416031940dfa8d27b42ed2f7625f40e.png',
  boncos: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/e7afea8315adb3c117622e6fbbf69ec9170c0febc94eaf5ecbf8bd51ac78201f.png',
};

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? `-Rp${formatted}` : `Rp${formatted}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const { s } = useLanguage();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchDashboard = async () => {
    try {
      const data = await apiFetch('/dashboard', { token });
      if (data.dashboard === null) {
        setDashboard(null);
      } else if (data.budget_id) {
        setDashboard(data);
      } else {
        setDashboard(null);
      }
    } catch (e) {
      console.error('Fetch dashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchDashboard();
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const addExpense = async (amount: number, expNote: string = '') => {
    if (!dashboard || amount <= 0) return;
    setSaving(true);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        token,
        body: {
          amount,
          note: expNote,
          budget_id: dashboard.budget_id,
        },
      });
      setShowInput(false);
      setCustomAmount('');
      setNote('');
      Keyboard.dismiss();
      fetchDashboard();
    } catch (e) {
      console.error('Add expense error:', e);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aman': return colors.statusAman;
      case 'agak_panas': return colors.statusAgakPanas;
      case 'rem_dikit': return colors.statusRemDikit;
      case 'boncos': return colors.statusBoncos;
      default: return colors.statusAman;
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.statusAman} />
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="wallet-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.noBudgetText, { color: colors.textSecondary }]} testID="no-budget-text">
          {s('no_budget')}
        </Text>
      </View>
    );
  }

  const statusColor = getStatusColor(dashboard.health_status);
  const statusImage = STATUS_IMAGES[dashboard.health_status];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.statusAman} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {s('welcome')}, {user?.name?.split(' ')[0]} 👋
            </Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* Main Hero Card */}
        <View
          testID="daily-allowance-card"
          style={[
            styles.heroCard,
            {
              backgroundColor: statusColor,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>{s('daily_allowance')}</Text>
            <View style={[styles.statusTag, { backgroundColor: '#111' }]}>
              <Text style={styles.statusTagText}>{s(dashboard.health_status).toUpperCase()}</Text>
            </View>
          </View>
          <Text testID="daily-allowance-display" style={styles.heroAmount}>
            {formatRupiah(dashboard.daily_allowance)}
          </Text>
          {statusImage && (
            <Image
              source={{ uri: statusImage }}
              style={styles.statusImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.heroFooter}>
            <Text style={styles.heroFooterText}>
              {dashboard.days_remaining} {s('days_left')}
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s('today_spent')}</Text>
            <Text testID="today-spent-display" style={[styles.statValue, { color: colors.text }]}>{formatRupiah(dashboard.today_spent)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s('today_remaining')}</Text>
            <Text testID="today-remaining-display" style={[styles.statValue, { color: dashboard.today_remaining >= 0 ? colors.statusAman : colors.statusBoncos }]}>
              {formatRupiah(dashboard.today_remaining)}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s('remaining_balance')}</Text>
            <Text testID="remaining-balance-display" style={[styles.statValue, { color: colors.text }]}>{formatRupiah(dashboard.current_balance)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s('total_spent')}</Text>
            <Text testID="total-spent-display" style={[styles.statValue, { color: colors.text }]}>{formatRupiah(dashboard.total_spent)}</Text>
          </View>
        </View>

        {/* Quick Input */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('quick_input')}</Text>
        <View style={styles.quickGrid}>
          {QUICK_AMOUNTS.map((amt) => (
            <TouchableOpacity
              key={amt}
              testID={`quick-expense-${amt / 1000}k`}
              style={[
                styles.quickBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: colors.shadow,
                },
              ]}
              onPress={() => addExpense(amt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickBtnText, { color: colors.text }]}>
                {amt / 1000}k
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Input Button */}
        <TouchableOpacity
          testID="custom-expense-btn"
          style={[
            styles.customBtn,
            {
              backgroundColor: colors.statusAman,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
          onPress={() => setShowInput(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={24} color="#111" />
          <Text style={styles.customBtnText}>{s('custom_amount')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Amount Modal */}
      <Modal visible={showInput} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={styles.modalBg} onPress={() => { setShowInput(false); Keyboard.dismiss(); }} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s('add_expense')}</Text>

            <TextInput
              testID="expense-amount-input"
              style={[styles.amountInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={customAmount}
              onChangeText={setCustomAmount}
              autoFocus
            />

            <TextInput
              testID="expense-note-input"
              style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={s('note_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={note}
              onChangeText={setNote}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="expense-cancel-btn"
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setShowInput(false); setCustomAmount(''); setNote(''); Keyboard.dismiss(); }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="expense-save-btn"
                style={[styles.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow }]}
                onPress={() => {
                  const amt = parseFloat(customAmount);
                  if (amt > 0) addExpense(amt, note);
                }}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#111" />
                ) : (
                  <Text style={styles.saveBtnText}>{s('save')}</Text>
                )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { paddingHorizontal: 20 },
  greetingRow: { marginBottom: 20 },
  greeting: { fontSize: 16, fontWeight: '600' },
  dateText: { fontSize: 13, marginTop: 2 },
  noBudgetText: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16, paddingHorizontal: 32 },

  // Hero card
  heroCard: {
    borderWidth: 4,
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heroLabel: { fontSize: 14, fontWeight: '700', color: '#111', letterSpacing: 1, textTransform: 'uppercase' },
  statusTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  statusTagText: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  heroAmount: { fontSize: 42, fontWeight: '900', color: '#111', letterSpacing: -2, marginBottom: 4 },
  statusImage: { width: 80, height: 80, position: 'absolute', right: 16, bottom: 16, opacity: 0.85 },
  heroFooter: { marginTop: 8 },
  heroFooterText: { fontSize: 13, fontWeight: '700', color: '#111', opacity: 0.7 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: {
    width: '47%',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  // Quick input
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5 },
  quickGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  quickBtnText: { fontSize: 18, fontWeight: '900' },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderRadius: 16,
    paddingVertical: 16,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  customBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 3,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.5 },
  amountInput: {
    fontSize: 32,
    fontWeight: '800',
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  noteInput: {
    fontSize: 15,
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 2, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },
});
