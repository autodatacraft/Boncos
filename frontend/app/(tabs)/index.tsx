import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
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
import DatePickerField, { toDateInputValue } from '@/src/components/DatePickerField';
import { apiFetchWithAuth, getDataMutationRevision } from '@/src/utils/api';
import { requestNotificationPermission, scheduleReminder, cancelReminders } from '@/src/utils/notifications';
import { getPendingMutationCount, queueCheckIn, queueExpense, syncPendingMutations } from '@/src/utils/offlineQueue';

function getGreeting(s: (k: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return s('good_morning');
  if (h < 18) return s('good_afternoon');
  return s('good_evening');
}

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
  category: string;
  icon: string;
  pacing_status?: string;
  pacing_amount?: number;
  pacing_insight?: string;
  recovery_daily_target?: number | null;
  recovery_tip?: string | null;
};

type BudgetPot = {
  budget_id: string;
  label: string;
  category: string;
  icon: string;
  total_balance: number;
  current_balance: number;
  refill_date: string;
};

type Streak = {
  current_streak: number;
  longest_streak: number;
  today_logged: boolean;
  last_7_days: { date: string; logged: boolean }[];
};

const STATUS_IMAGES: Record<string, string> = {
  aman: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/ab4b7e50b1748300f9b350fe68960e7375287a6767468b28fdd160e2d398fb5a.png',
  agak_panas: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/07f1ebb03e94054a83f741777c2243c75283f19dd2f2c40276cec14c37a49c95.png',
  rem_dikit: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/011dc7c7846fdb1d4682cdfab02d93216416031940dfa8d27b42ed2f7625f40e.png',
  boncos: 'https://static.prod-images.emergentagent.com/jobs/c953d330-38ae-4370-b16c-6a5d27c9448f/images/e7afea8315adb3c117622e6fbbf69ec9170c0febc94eaf5ecbf8bd51ac78201f.png',
};

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000];

const CATEGORY_ICONS: Record<string, string> = {
  makan: 'restaurant',
  transport: 'car',
  kopi: 'cafe',
  entertainment: 'game-controller',
  belanja: 'bag',
  umum: 'wallet',
};

// Thousand separator helpers (Indonesian: dot as thousand, comma as decimal)
function toThousandSep(n: number): string {
  const abs = Math.abs(Math.round(n));
  return abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRupiah(n: number): string {
  return n < 0 ? `-Rp${toThousandSep(n)}` : `Rp${toThousandSep(n)}`;
}

// Format display value for textbox (with thousand separator)
function formatInputDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parse formatted string to number
function parseFormattedNumber(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
}

const DAY_LABELS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const { s, lang } = useLanguage();
  const amountInputRef = useRef<TextInput>(null);
  const selectedBudgetIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  const lastLoadedRevisionRef = useRef(-1);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [budgets, setBudgets] = useState<BudgetPot[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);

  // Expense form state
  const [amountDisplay, setAmountDisplay] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => toDateInputValue(new Date()));
  const [saving, setSaving] = useState(false);

  const fetchAll = async (budgetOverride?: string | null) => {
    try {
      const syncResult = await syncPendingMutations();
      setPendingQueueCount(syncResult.pending);

      // Fetch budgets list
      const budgetsData = await apiFetchWithAuth('/budgets', { token });
      const pots: BudgetPot[] = budgetsData.budgets || [];
      setBudgets(pots);

      // Auto-select first non-locked budget if none selected
      let budgetId = budgetOverride !== undefined ? budgetOverride : selectedBudgetIdRef.current;
      const activePots = pots.filter((p: any) => !p.is_locked);
      if (!budgetId && activePots.length > 0) {
        budgetId = activePots[0].budget_id;
        selectedBudgetIdRef.current = budgetId;
        setSelectedBudgetId(budgetId);
      }

      // Fetch dashboard for selected budget
      if (budgetId) {
        const dashData = await apiFetchWithAuth(`/dashboard?budget_id=${budgetId}`, { token });
        if (dashData.dashboard === null || dashData.error) {
          setDashboard(null);
        } else if (dashData.budget_id) {
          setDashboard(dashData);
        } else {
          setDashboard(null);
        }
      } else {
        setDashboard(null);
      }

      // Fetch streak
      const streakData = await apiFetchWithAuth('/streak', { token });
      if (streakData.current_streak !== undefined) {
        setStreak(streakData);
        // Schedule reminders if user hasn't logged today
        if (!streakData.today_logged) {
          const granted = await requestNotificationPermission();
          if (granted) {
            scheduleReminder(s('reminder_title'), s('reminder_body'));
          }
        } else {
          cancelReminders();
        }
      }
    } catch (e) {
      console.error('Fetch error:', e);
      setPendingQueueCount(await getPendingMutationCount());
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
        fetchAll();
      } else if (lastLoadedRevisionRef.current !== revision) {
        fetchAll();
      }
    }, [token])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const selectBudget = (budgetId: string) => {
    selectedBudgetIdRef.current = budgetId;
    setSelectedBudgetId(budgetId);
    setLoading(true);
    fetchAll(budgetId);
  };

  const handleAmountChange = (text: string) => {
    // Only keep digits, then format with thousand separator
    const digits = text.replace(/\D/g, '');
    setAmountDisplay(formatInputDisplay(digits));
  };

  const handleQuickFill = (amt: number) => {
    // Quick fill just sets the amount in the textbox, doesn't submit
    const currentAmt = parseFormattedNumber(amountDisplay);
    const newAmt = currentAmt + amt;
    setAmountDisplay(toThousandSep(newAmt));
    amountInputRef.current?.focus();
  };

  const markLocalCheckIn = (date: string) => {
    setStreak((prev) => {
      if (!prev) return prev;
      const today = toDateInputValue(new Date());
      return {
        ...prev,
        today_logged: prev.today_logged || date === today,
        current_streak: date === today ? Math.max(prev.current_streak, 1) : prev.current_streak,
        longest_streak: date === today ? Math.max(prev.longest_streak, prev.current_streak, 1) : prev.longest_streak,
        last_7_days: prev.last_7_days.map((day) => day.date === date ? { ...day, logged: true } : day),
      };
    });
  };

  const handleSaveExpense = async () => {
    const amount = parseFormattedNumber(amountDisplay);
    if (!dashboard || amount <= 0) return;
    setSaving(true);
    try {
      const result = await apiFetchWithAuth('/expenses', {
        method: 'POST',
        token,
        body: { amount, note, budget_id: dashboard.budget_id, expense_date: expenseDate },
      });
      if (!result.error) {
        setAmountDisplay('');
        setNote('');
        setExpenseDate(toDateInputValue(new Date()));
        Keyboard.dismiss();
        cancelReminders(); // User logged, cancel reminders
        fetchAll();
      } else if (result.error === 'Network error') {
        const count = await queueExpense({ amount, note, budget_id: dashboard.budget_id, expense_date: expenseDate });
        setPendingQueueCount(count);
        markLocalCheckIn(expenseDate);
        setAmountDisplay('');
        setNote('');
        setExpenseDate(toDateInputValue(new Date()));
        Keyboard.dismiss();
        Alert.alert(lang === 'id' ? 'Disimpan offline' : 'Saved offline', lang === 'id' ? 'Pengeluaran akan disync saat online.' : 'This expense will sync when you are online.');
      }
    } catch (e) {
      console.error('Save expense error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleNoSpendCheckIn = async () => {
    if (streak?.today_logged || checkingIn) return;
    setCheckingIn(true);
    const today = toDateInputValue(new Date());
    try {
      const result = await apiFetchWithAuth('/check-in', {
        method: 'POST',
        token,
        body: { checkin_date: today, note: 'no_spend' },
      });
      if (!result.error) {
        cancelReminders();
        fetchAll();
      } else if (result.error === 'Network error') {
        const count = await queueCheckIn({ checkin_date: today, note: 'no_spend' });
        setPendingQueueCount(count);
        markLocalCheckIn(today);
        cancelReminders();
        Alert.alert(lang === 'id' ? 'Check-in offline' : 'Offline check-in', lang === 'id' ? 'Check-in hari ini akan disync saat online.' : "Today's check-in will sync when you are online.");
      }
    } finally {
      setCheckingIn(false);
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

  if (budgets.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="wallet-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.noBudgetText, { color: colors.textSecondary }]} testID="no-budget-text">
          {s('no_budget')}
        </Text>
      </View>
    );
  }

  const statusColor = dashboard ? getStatusColor(dashboard.health_status) : colors.statusAman;
  const statusImage = dashboard ? STATUS_IMAGES[dashboard.health_status] : '';
  const dayLabels = lang === 'id' ? DAY_LABELS_ID : DAY_LABELS_EN;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.statusAman} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {getGreeting(s)}, {user?.name?.split(' ')[0]} 👋
            </Text>
            {user?.supporter_badge && (
              <View style={[styles.greetBadge, { backgroundColor: colors.statusAman }]}>
                <Text style={styles.greetBadgeText}>{user.supporter_badge}</Text>
              </View>
            )}
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          {/* Streak badge */}
          {streak && (
            <View style={[styles.streakBadge, { backgroundColor: streak.today_logged ? colors.statusAman : colors.statusAgakPanas, borderColor: colors.border }]}>
              <Text style={styles.streakNumber}>{streak.current_streak}</Text>
              <Text style={styles.streakFire}>🔥</Text>
            </View>
          )}
        </View>

        {/* Budget Pot Selector - horizontal scroll */}
        {budgets.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.potScroll} contentContainerStyle={styles.potScrollContent}>
            {budgets.filter((p: any) => !p.is_locked).map((pot) => {
              const isSelected = pot.budget_id === selectedBudgetId;
              return (
                <TouchableOpacity
                  key={pot.budget_id}
                  testID={`pot-select-${pot.budget_id}`}
                  style={[
                    styles.potChip,
                    {
                      backgroundColor: isSelected ? colors.statusAman : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => {
                    selectBudget(pot.budget_id);
                  }}
                >
                  <Text style={[styles.potChipText, { color: isSelected ? '#111' : colors.text }]}>
                    {pot.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Main Hero Card */}
        {dashboard && (
          <>
            <View
              testID="daily-allowance-card"
              style={[styles.heroCard, { backgroundColor: statusColor, borderColor: colors.border, shadowColor: colors.shadow }]}
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
              {statusImage ? (
                <Image source={{ uri: statusImage }} style={styles.statusImage} resizeMode="contain" />
              ) : null}
              <View style={styles.heroFooter}>
                <Text style={styles.heroFooterText}>
                  {dashboard.days_remaining} {s('days_left')}
                </Text>
              </View>
            </View>

            {pendingQueueCount > 0 && (
              <View style={[styles.queueBanner, { backgroundColor: colors.statusAgakPanas, borderColor: colors.border }]}>
                <Ionicons name="cloud-upload-outline" size={18} color="#111" />
                <Text style={styles.queueBannerText}>
                  {lang === 'id' ? `${pendingQueueCount} input menunggu sync` : `${pendingQueueCount} inputs waiting to sync`}
                </Text>
              </View>
            )}

            {(dashboard.pacing_insight || dashboard.recovery_tip) && (
              <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                {dashboard.pacing_insight && (
                  <View style={styles.insightRow}>
                    <Ionicons
                      name={dashboard.pacing_status === 'overspend' ? 'warning-outline' : 'checkmark-circle-outline'}
                      size={20}
                      color={dashboard.pacing_status === 'overspend' ? colors.statusBoncos : colors.statusAman}
                    />
                    <Text style={[styles.insightText, { color: colors.text }]}>{dashboard.pacing_insight}</Text>
                  </View>
                )}
                {dashboard.recovery_tip && (
                  <View style={styles.insightRow}>
                    <Ionicons name="speedometer-outline" size={20} color={colors.statusRemDikit} />
                    <Text style={[styles.insightText, { color: colors.text }]}>{dashboard.recovery_tip}</Text>
                  </View>
                )}
              </View>
            )}

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
          </>
        )}

        {/* ─── Inline Expense Input Form ─── */}
        {dashboard && (
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <Text style={[styles.inputCardTitle, { color: colors.text }]}>{s('add_expense')}</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('expense_date')}</Text>
            <DatePickerField
              testID="expense-date-input"
              value={expenseDate}
              onChange={setExpenseDate}
              colors={colors}
              todayLabel={s('today')}
              doneLabel={lang === 'id' ? 'Selesai' : 'Done'}
            />

            {/* Amount textbox */}
            <View style={[styles.amountRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.amountPrefix, { color: colors.textSecondary }]}>Rp</Text>
              <TextInput
                ref={amountInputRef}
                testID="expense-amount-input"
                style={[styles.amountInput, { color: colors.text }]}
                placeholder={s('input_amount')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={amountDisplay}
                onChangeText={handleAmountChange}
              />
            </View>

            {/* Quick fill buttons */}
            <View style={styles.quickGrid}>
              {QUICK_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  testID={`quick-expense-${amt / 1000}k`}
                  style={[styles.quickBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleQuickFill(amt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickBtnText, { color: colors.text }]}>+{amt / 1000}k</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note textbox */}
            <TextInput
              testID="expense-note-input"
              style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder={s('note_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={note}
              onChangeText={setNote}
            />

            {/* Save button */}
            <TouchableOpacity
              testID="expense-save-btn"
              style={[styles.saveBtn, {
                backgroundColor: parseFormattedNumber(amountDisplay) > 0 ? colors.statusAman : colors.textSecondary,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              }]}
              onPress={handleSaveExpense}
              disabled={saving || parseFormattedNumber(amountDisplay) <= 0}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#111" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#111" />
                  <Text style={styles.saveBtnText}>{s('save')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {dashboard && streak && !streak.today_logged && (
          <TouchableOpacity
            testID="no-spend-checkin-btn"
            style={[styles.noSpendBtn, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={handleNoSpendCheckIn}
            disabled={checkingIn}
            activeOpacity={0.75}
          >
            {checkingIn ? (
              <ActivityIndicator size="small" color={colors.statusAman} />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.statusAman} />
                <Text style={[styles.noSpendText, { color: colors.text }]}>
                  {lang === 'id' ? 'Hari ini aman, tidak ada pengeluaran' : 'No spending today'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ─── Streak Section ─── */}
        {streak && (
          <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={styles.streakHeader}>
              <Text style={[styles.streakTitle, { color: colors.text }]}>{s('streak')} 🔥</Text>
              <Text style={[styles.streakStatus, { color: streak.today_logged ? colors.statusAman : colors.statusBoncos }]}>
                {streak.today_logged ? s('today_logged') : s('not_logged_today')}
              </Text>
            </View>
            <View style={styles.streakStats}>
              <View style={styles.streakStatItem}>
                <Text style={[styles.streakStatNum, { color: colors.statusAman }]}>{streak.current_streak}</Text>
                <Text style={[styles.streakStatLabel, { color: colors.textSecondary }]}>{s('current_streak')}</Text>
              </View>
              <View style={[styles.streakDivider, { backgroundColor: colors.border }]} />
              <View style={styles.streakStatItem}>
                <Text style={[styles.streakStatNum, { color: colors.statusAgakPanas }]}>{streak.longest_streak}</Text>
                <Text style={[styles.streakStatLabel, { color: colors.textSecondary }]}>{s('longest_streak')}</Text>
              </View>
            </View>
            {/* 7-day calendar */}
            <View style={styles.weekRow}>
              {streak.last_7_days.map((day, i) => {
                const d = new Date(day.date + 'T12:00:00');
                const dayLabel = dayLabels[d.getDay()];
                const isToday = i === streak.last_7_days.length - 1;
                return (
                  <View key={day.date} style={styles.weekDay}>
                    <Text style={[styles.weekDayLabel, { color: colors.textSecondary }]}>{dayLabel}</Text>
                    <View
                      style={[
                        styles.weekDot,
                        {
                          backgroundColor: day.logged ? colors.statusAman : (isToday ? colors.statusAgakPanas : colors.background),
                          borderColor: isToday ? colors.text : colors.border,
                          borderWidth: isToday ? 2 : 1,
                        },
                      ]}
                    >
                      {day.logged && <Ionicons name="checkmark" size={12} color="#111" />}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { paddingHorizontal: 20 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  greeting: { fontSize: 16, fontWeight: '600' },
  greetBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  greetBadgeText: { fontSize: 10, fontWeight: '800', color: '#111' },
  dateText: { fontSize: 13, marginTop: 2 },
  noBudgetText: { fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: 16, paddingHorizontal: 32 },

  // Streak badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    gap: 2,
  },
  streakNumber: { fontSize: 16, fontWeight: '900', color: '#111' },
  streakFire: { fontSize: 14 },

  // Pot selector
  potScroll: { marginBottom: 16 },
  potScrollContent: { gap: 8 },
  potChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
  },
  potChipText: { fontSize: 13, fontWeight: '700' },

  // Hero card
  heroCard: {
    borderWidth: 4,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
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
  heroAmount: { fontSize: 38, fontWeight: '900', color: '#111', letterSpacing: -2, marginBottom: 4 },
  statusImage: { width: 72, height: 72, position: 'absolute', right: 16, bottom: 16, opacity: 0.85 },
  heroFooter: { marginTop: 8 },
  heroFooterText: { fontSize: 13, fontWeight: '700', color: '#111', opacity: 0.7 },

  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  queueBannerText: { color: '#111', fontSize: 13, fontWeight: '800' },
  insightCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    gap: 10,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%',
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.5 },

  // Inline expense input card
  inputCard: {
    borderWidth: 3,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  inputCardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14, letterSpacing: -0.5 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  amountPrefix: { fontSize: 20, fontWeight: '700', marginRight: 4 },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: 14,
  },
  quickGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  quickBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickBtnText: { fontSize: 14, fontWeight: '800' },
  noteInput: {
    fontSize: 15,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderRadius: 14,
    paddingVertical: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },

  noSpendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  noSpendText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },

  // Streak card
  streakCard: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  streakTitle: { fontSize: 16, fontWeight: '800' },
  streakStatus: { fontSize: 12, fontWeight: '700' },
  streakStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  streakStatItem: { flex: 1, alignItems: 'center' },
  streakStatNum: { fontSize: 28, fontWeight: '900' },
  streakStatLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  streakDivider: { width: 1, height: 36, opacity: 0.3 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 4 },
  weekDayLabel: { fontSize: 11, fontWeight: '600' },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
