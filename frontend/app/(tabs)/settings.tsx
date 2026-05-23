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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetch } from '@/src/utils/api';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { s, lang, setLang } = useLanguage();

  const [balance, setBalance] = useState('');
  const [refillDate, setRefillDate] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasBudget, setHasBudget] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(true);

  const fetchBudget = async () => {
    try {
      const data = await apiFetch('/budgets', { token });
      if (data.budget_id) {
        setBalance(String(data.total_balance));
        setRefillDate(data.refill_date.split('T')[0]);
        setLabel(data.label || '');
        setHasBudget(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBudget(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoadingBudget(true);
      fetchBudget();
    }, [token])
  );

  const saveBudget = async () => {
    const amt = parseFloat(balance);
    if (!amt || amt <= 0) {
      Alert.alert('Error', s('total_balance') + ' invalid');
      return;
    }
    if (!refillDate || !/^\d{4}-\d{2}-\d{2}$/.test(refillDate)) {
      Alert.alert('Error', s('refill_date') + ' format: YYYY-MM-DD');
      return;
    }
    setSaving(true);
    Keyboard.dismiss();
    try {
      await apiFetch('/budgets', {
        method: 'POST',
        token,
        body: {
          total_balance: amt,
          refill_date: refillDate + 'T23:59:59',
          label: label || 'Budget Utama',
        },
      });
      Alert.alert('✅', s('budget_saved'));
      setHasBudget(true);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(s('logout'), '', [
      { text: s('cancel'), style: 'cancel' },
      {
        text: s('logout'),
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.text }]} testID="settings-title">{s('settings')}</Text>

        {/* User info */}
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

        {/* Budget Setup */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('budget_setup')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('total_balance')} (IDR)</Text>
          <TextInput
            testID="budget-balance-input"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="3000000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            value={balance}
            onChangeText={setBalance}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('refill_date')}</Text>
          <TextInput
            testID="budget-refill-date-input"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="2026-06-25"
            placeholderTextColor={colors.textSecondary}
            value={refillDate}
            onChangeText={setRefillDate}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{s('budget_label')}</Text>
          <TextInput
            testID="budget-label-input"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Budget Utama"
            placeholderTextColor={colors.textSecondary}
            value={label}
            onChangeText={setLabel}
          />

          <TouchableOpacity
            testID="save-budget-btn"
            style={[styles.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow }]}
            onPress={saveBudget}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#111" />
            ) : (
              <Text style={styles.saveBtnText}>{s('save_budget')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Language */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('language')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              testID="lang-id-btn"
              style={[
                styles.toggleBtn,
                lang === 'id' && { backgroundColor: colors.statusAman, borderColor: colors.border },
                { borderColor: colors.border },
              ]}
              onPress={() => setLang('id')}
            >
              <Text style={[styles.toggleText, { color: lang === 'id' ? '#111' : colors.text }]}>🇮🇩 Indonesia</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="lang-en-btn"
              style={[
                styles.toggleBtn,
                lang === 'en' && { backgroundColor: colors.statusAman, borderColor: colors.border },
                { borderColor: colors.border },
              ]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.toggleText, { color: lang === 'en' ? '#111' : colors.text }]}>🇺🇸 English</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Theme */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{s('theme')}</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <TouchableOpacity
            testID="toggle-theme-btn"
            style={[styles.themeBtn, { borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={22} color={colors.text} />
            <Text style={[styles.themeBtnText, { color: colors.text }]}>
              {mode === 'dark' ? s('dark_mode') : s('light_mode')}
            </Text>
            <Ionicons name="swap-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          testID="logout-btn"
          style={[styles.logoutBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border, shadowColor: colors.shadow }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>{s('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 20 },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#111' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },

  // Sections
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, letterSpacing: -0.5 },
  card: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  saveBtn: {
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

  // Toggles
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleText: { fontSize: 15, fontWeight: '700' },

  // Theme
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
  },
  themeBtnText: { fontSize: 15, fontWeight: '700', flex: 1 },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 3,
    borderRadius: 14,
    paddingVertical: 16,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
