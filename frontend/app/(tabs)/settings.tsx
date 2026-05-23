import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetch } from '@/src/utils/api';

type BudgetPot = {
  budget_id: string;
  label: string;
  category: string;
  icon: string;
  total_balance: number;
  current_balance: number;
  refill_date: string;
  created_at: string;
};

const CATEGORIES = [
  { key: 'makan', icon: 'restaurant' },
  { key: 'transport', icon: 'car' },
  { key: 'kopi', icon: 'cafe' },
  { key: 'entertainment', icon: 'game-controller' },
  { key: 'belanja', icon: 'bag' },
  { key: 'umum', icon: 'wallet' },
];

function formatInputDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function parseFormattedNumber(formatted: string): number {
  return parseInt(formatted.replace(/\D/g, ''), 10) || 0;
}
function formatRupiah(n: number): string {
  const abs = Math.abs(Math.round(n));
  return `Rp${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { s, lang, setLang } = useLanguage();

  const [pots, setPots] = useState<BudgetPot[]>([]);
  const [loadingPots, setLoadingPots] = useState(true);

  // New pot form
  const [balanceDisplay, setBalanceDisplay] = useState('');
  const [refillDate, setRefillDate] = useState('');
  const [label, setLabel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('umum');
  const [saving, setSaving] = useState(false);

  // Edit pot modal
  const [editPot, setEditPot] = useState<BudgetPot | null>(null);
  const [editBalanceDisplay, setEditBalanceDisplay] = useState('');
  const [editRefillDate, setEditRefillDate] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const fetchPots = async () => {
    try {
      const data = await apiFetch('/budgets', { token });
      setPots(data.budgets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPots(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoadingPots(true);
      fetchPots();
    }, [token])
  );

  const handleBalanceChange = (text: string) => {
    setBalanceDisplay(formatInputDisplay(text.replace(/\D/g, '')));
  };

  const saveBudget = async () => {
    const amt = parseFormattedNumber(balanceDisplay);
    if (!amt || amt <= 0) { Alert.alert('Error', s('total_balance') + ' invalid'); return; }
    if (!refillDate || !/^\d{4}-\d{2}-\d{2}$/.test(refillDate)) { Alert.alert('Error', s('refill_date') + ' format: YYYY-MM-DD'); return; }
    setSaving(true);
    Keyboard.dismiss();
    const cat = CATEGORIES.find((c) => c.key === selectedCategory);
    const result = await apiFetch('/budgets', {
      method: 'POST', token,
      body: { total_balance: amt, refill_date: refillDate + 'T23:59:59', label: label || s(`cat_${selectedCategory}`), category: selectedCategory, icon: cat?.icon || 'wallet' },
    });
    if (!result.error) {
      Alert.alert('✅', s('budget_saved'));
      setBalanceDisplay(''); setRefillDate(''); setLabel(''); setSelectedCategory('umum');
      fetchPots();
    }
    setSaving(false);
  };

  const openEditModal = (pot: BudgetPot) => {
    setEditPot(pot);
    setEditBalanceDisplay(formatInputDisplay(String(pot.total_balance)));
    setEditRefillDate(pot.refill_date.split('T')[0]);
    setEditLabel(pot.label);
  };

  const saveEditBudget = async () => {
    if (!editPot) return;
    const amt = parseFormattedNumber(editBalanceDisplay);
    if (!amt || amt <= 0) { Alert.alert('Error', s('total_balance') + ' invalid'); return; }
    setEditSaving(true);
    Keyboard.dismiss();
    const result = await apiFetch(`/budgets/${editPot.budget_id}`, {
      method: 'PATCH', token,
      body: {
        total_balance: amt,
        refill_date: editRefillDate ? editRefillDate + 'T23:59:59' : undefined,
        label: editLabel || undefined,
      },
    });
    if (!result.error) {
      Alert.alert('✅', s('budget_updated'));
      setEditPot(null);
      fetchPots();
    }
    setEditSaving(false);
  };

  const deletePot = (budgetId: string) => {
    Alert.alert(s('delete_pot'), '', [
      { text: s('cancel'), style: 'cancel' },
      {
        text: s('delete'), style: 'destructive',
        onPress: async () => {
          await apiFetch(`/budgets/${budgetId}`, { method: 'DELETE', token });
          fetchPots();
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(s('logout'), '', [
      { text: s('cancel'), style: 'cancel' },
      { text: s('logout'), style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]} testID="settings-title">{s('settings')}</Text>

        {user && (
          <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[styles.avatar, { backgroundColor: colors.statusAman, borderColor: colors.border }]}>
              <Text style={styles.avatarText}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
            </View>
          </View>
        )}

        {/* Existing Budget Pots with Edit */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('budget_pots')}</Text>
        {loadingPots ? (
          <ActivityIndicator size="small" color={colors.statusAman} style={{ marginBottom: 16 }} />
        ) : pots.length === 0 ? (
          <View style={[styles.emptyPots, { borderColor: colors.border }]}>
            <Text style={[styles.emptyPotsText, { color: colors.textSecondary }]}>{s('no_pots')}</Text>
          </View>
        ) : (
          pots.map((pot) => (
            <View key={pot.budget_id} testID={`pot-item-${pot.budget_id}`} style={[styles.potItem, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={[styles.potIcon, { backgroundColor: colors.statusAman, borderColor: colors.border }]}>
                <Ionicons name={(pot.icon || 'wallet') as any} size={18} color="#111" />
              </View>
              <View style={styles.potInfo}>
                <Text style={[styles.potLabel, { color: colors.text }]}>{pot.label}</Text>
                <Text style={[styles.potBalance, { color: colors.textSecondary }]}>
                  {formatRupiah(pot.current_balance)} / {formatRupiah(pot.total_balance)}
                </Text>
              </View>
              <TouchableOpacity testID={`edit-pot-${pot.budget_id}`} onPress={() => openEditModal(pot)} style={styles.potActionBtn}>
                <Ionicons name="pencil" size={16} color={colors.statusAgakPanas} />
              </TouchableOpacity>
              <TouchableOpacity testID={`delete-pot-${pot.budget_id}`} onPress={() => deletePot(pot.budget_id)} style={styles.potActionBtn}>
                <Ionicons name="close-circle" size={18} color={colors.statusBoncos} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Add New Budget Pot */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('add_pot')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
            {CATEGORIES.map((cat) => {
              const isActive = cat.key === selectedCategory;
              return (
                <TouchableOpacity key={cat.key} testID={`cat-select-${cat.key}`} style={[styles.catChip, { backgroundColor: isActive ? colors.statusAman : colors.background, borderColor: colors.border }]}
                  onPress={() => { setSelectedCategory(cat.key); if (!label) setLabel(s(`cat_${cat.key}`)); }}>
                  <Ionicons name={cat.icon as any} size={16} color={isActive ? '#111' : colors.text} />
                  <Text style={[styles.catChipText, { color: isActive ? '#111' : colors.text }]}>{s(`cat_${cat.key}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('budget_label')}</Text>
          <TextInput testID="budget-label-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder={s(`cat_${selectedCategory}`)} placeholderTextColor={colors.textSecondary} value={label} onChangeText={setLabel} />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('total_balance')} (IDR)</Text>
          <View style={[styles.balanceRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.balancePrefix, { color: colors.textSecondary }]}>Rp</Text>
            <TextInput testID="budget-balance-input" style={[styles.balanceInput, { color: colors.text }]} placeholder="3.000.000" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={balanceDisplay} onChangeText={handleBalanceChange} />
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('refill_date')}</Text>
          <TextInput testID="budget-refill-date-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="2026-06-25" placeholderTextColor={colors.textSecondary} value={refillDate} onChangeText={setRefillDate} />

          <TouchableOpacity testID="save-budget-btn" style={[styles.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={saveBudget} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.saveBtnText}>{s('save_budget')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Language */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('language')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.toggleRow}>
            <TouchableOpacity testID="lang-id-btn" style={[styles.toggleBtn, lang === 'id' && { backgroundColor: colors.statusAman }, { borderColor: colors.border }]} onPress={() => setLang('id')}>
              <Text style={[styles.toggleText, { color: lang === 'id' ? '#111' : colors.text }]}>🇮🇩 Indonesia</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="lang-en-btn" style={[styles.toggleBtn, lang === 'en' && { backgroundColor: colors.statusAman }, { borderColor: colors.border }]} onPress={() => setLang('en')}>
              <Text style={[styles.toggleText, { color: lang === 'en' ? '#111' : colors.text }]}>🇺🇸 English</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('theme')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <TouchableOpacity testID="toggle-theme-btn" style={[styles.themeBtn, { borderColor: colors.border }]} onPress={toggleTheme}>
            <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={22} color={colors.text} />
            <Text style={[styles.themeBtnText, { color: colors.text }]}>{mode === 'dark' ? s('dark_mode') : s('light_mode')}</Text>
            <Ionicons name="swap-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="logout-btn" style={[styles.logoutBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>{s('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Budget Modal */}
      <Modal visible={!!editPot} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} onPress={() => { setEditPot(null); Keyboard.dismiss(); }} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s('edit_budget')}: {editPot?.label}</Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('budget_label')}</Text>
            <TextInput testID="edit-label-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editLabel} onChangeText={setEditLabel} />

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('new_total')} (IDR)</Text>
            <View style={[styles.balanceRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.balancePrefix, { color: colors.textSecondary }]}>Rp</Text>
              <TextInput testID="edit-balance-input" style={[styles.balanceInput, { color: colors.text }]} keyboardType="numeric" value={editBalanceDisplay} onChangeText={(t) => setEditBalanceDisplay(formatInputDisplay(t.replace(/\D/g, '')))} />
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('refill_date')}</Text>
            <TextInput testID="edit-refill-input" style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="2026-06-25" placeholderTextColor={colors.textSecondary} value={editRefillDate} onChangeText={setEditRefillDate} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditPot(null)}>
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>{s('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-edit-btn" style={[styles.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={saveEditBudget} disabled={editSaving}>
                {editSaving ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.saveBtnText}>{s('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 16, padding: 16, marginBottom: 24, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  avatar: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#111' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },
  emptyPots: { borderWidth: 2, borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 20, borderStyle: 'dashed' },
  emptyPotsText: { fontSize: 14, fontWeight: '600' },
  potItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 14, padding: 12, marginBottom: 10, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  potIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  potInfo: { flex: 1 },
  potLabel: { fontSize: 15, fontWeight: '700' },
  potBalance: { fontSize: 12, marginTop: 2 },
  potActionBtn: { padding: 6, marginLeft: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 4, letterSpacing: -0.5 },
  card: { borderWidth: 2, borderRadius: 16, padding: 16, marginBottom: 24, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  balancePrefix: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  balanceInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 14 },
  catScroll: { marginBottom: 16 },
  catScrollContent: { gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
  catChipText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { borderWidth: 3, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  toggleText: { fontSize: 15, fontWeight: '700' },
  themeBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 12, padding: 14 },
  themeBtnText: { fontSize: 15, fontWeight: '700', flex: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 3, borderRadius: 14, paddingVertical: 16, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 3, borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 2, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '700' },
});
