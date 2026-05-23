import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator, Modal, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useLanguage } from '@/src/contexts/LanguageContext';
import { apiFetch } from '@/src/utils/api';
import * as Linking from 'expo-linking';

type BudgetPot = { budget_id: string; label: string; category: string; icon: string; total_balance: number; current_balance: number; refill_date: string; created_at: string; is_locked?: boolean; locked_reason?: string; shared?: boolean; shared_by?: string };
type Plan = { id: string; displayName: string; badgeName: string | null; priceLabel: string; maxBudgetPots: number; isUnlimited: boolean };

const CATEGORIES = [
  { key: 'makan', icon: '🍔', label_id: 'Makan', label_en: 'Food' },
  { key: 'transport', icon: '🚗', label_id: 'Transport', label_en: 'Transport' },
  { key: 'kopi', icon: '☕', label_id: 'Kopi/Jajan', label_en: 'Coffee/Snacks' },
  { key: 'entertainment', icon: '🎮', label_id: 'Hiburan', label_en: 'Entertainment' },
  { key: 'belanja', icon: '🛍️', label_id: 'Belanja', label_en: 'Shopping' },
  { key: 'umum', icon: '💰', label_id: 'Umum', label_en: 'General' },
];

const PLAN_EMOJIS: Record<string, string> = { FREE: '🆓', AMERICANO: '☕', KOPI_GULA_AREN: '🥤', V60: '👑' };

function fmtInput(raw: string): string { const d = raw.replace(/\D/g, ''); return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''; }
function parseNum(f: string): number { return parseInt(f.replace(/\D/g, ''), 10) || 0; }
function fmtRp(n: number): string { return `Rp${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`; }

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, logout } = useAuth();
  const { colors, mode, toggleTheme } = useTheme();
  const { s, lang, setLang } = useLanguage();

  const [pots, setPots] = useState<BudgetPot[]>([]);
  const [planId, setPlanId] = useState('FREE');
  const [planLimit, setPlanLimit] = useState(2);
  const [loadingPots, setLoadingPots] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [streak, setStreak] = useState<any>(null);

  // New pot form
  const [balDisp, setBalDisp] = useState('');
  const [refDate, setRefDate] = useState('');
  const [label, setLabel] = useState('');
  const [selCat, setSelCat] = useState('umum');
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editPot, setEditPot] = useState<BudgetPot | null>(null);
  const [editBal, setEditBal] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Sub modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [subbing, setSubbing] = useState('');

  // Share modal
  const [sharePot, setSharePot] = useState<BudgetPot | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharedWith, setSharedWith] = useState<string[]>([]);

  // Contact Us
  const [showContact, setShowContact] = useState(false);
  const [contactMsg, setContactMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Offline
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Simple offline detection
    const checkOnline = () => setIsOffline(!navigator.onLine);
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', () => setIsOffline(false));
      window.addEventListener('offline', () => setIsOffline(true));
    }
  }, []);

  const fetchAll = async () => {
    const [budData, plansData, streakData] = await Promise.all([
      apiFetch('/budgets', { token }),
      apiFetch('/plans', { token }),
      apiFetch('/streak', { token }),
    ]);
    setPots(budData.budgets || []);
    setPlanId(budData.plan || 'FREE');
    setPlanLimit(budData.plan_limit || 2);
    if (plansData.plans) setPlans(plansData.plans);
    if (streakData.current_streak !== undefined) setStreak(streakData);
    setLoadingPots(false);
  };

  useFocusEffect(useCallback(() => { setLoadingPots(true); fetchAll(); }, [token]));

  const saveBudget = async () => {
    const amt = parseNum(balDisp);
    if (!amt) { Alert.alert('Error', 'Invalid balance'); return; }
    if (!refDate || !/^\d{4}-\d{2}-\d{2}$/.test(refDate)) { Alert.alert('Error', 'Format: YYYY-MM-DD'); return; }
    setSaving(true); Keyboard.dismiss();
    const cat = CATEGORIES.find(c => c.key === selCat);
    const res = await apiFetch('/budgets', { method: 'POST', token, body: { total_balance: amt, refill_date: refDate + 'T23:59:59', label: label || (lang === 'id' ? cat?.label_id : cat?.label_en), category: selCat, icon: cat?.icon || 'wallet' } });
    if (res.error) {
      if (res.status === 403) { setShowSubModal(true); }
      else Alert.alert('Error', res.error);
    } else {
      Alert.alert('✅', s('budget_saved')); setBalDisp(''); setRefDate(''); setLabel(''); setSelCat('umum');
      fetchAll();
    }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editPot) return;
    const amt = parseNum(editBal);
    if (!amt) { Alert.alert('Error', 'Invalid'); return; }
    setEditSaving(true); Keyboard.dismiss();
    const res = await apiFetch(`/budgets/${editPot.budget_id}`, { method: 'PATCH', token, body: { total_balance: amt, refill_date: editRef ? editRef + 'T23:59:59' : undefined, label: editLabel || undefined } });
    if (res.error) { if (res.status === 403) { setEditPot(null); setShowSubModal(true); } else Alert.alert('Error', res.error); }
    else { Alert.alert('✅', s('budget_updated')); setEditPot(null); fetchAll(); }
    setEditSaving(false);
  };

  const deletePot = (id: string) => Alert.alert(s('delete_pot'), '', [{ text: s('cancel'), style: 'cancel' }, { text: s('delete'), style: 'destructive', onPress: async () => { await apiFetch(`/budgets/${id}`, { method: 'DELETE', token }); fetchAll(); } }]);

  const subscribe = async (pid: string) => {
    setSubbing(pid);
    const res = await apiFetch('/subscribe', { method: 'POST', token, body: { plan_id: pid } });
    if (!res.error) { Alert.alert('🎉', `${res.badge || 'Subscribed'}!`); setShowSubModal(false); fetchAll(); }
    setSubbing('');
  };

  const openShare = async (pot: BudgetPot) => {
    setSharePot(pot); setShareEmail('');
    const res = await apiFetch(`/budgets/${pot.budget_id}/shared`, { token });
    setSharedWith(res.shared_with || []);
  };

  const doShare = async () => {
    if (!sharePot || !shareEmail) return;
    const res = await apiFetch('/budgets/share', { method: 'POST', token, body: { budget_id: sharePot.budget_id, email: shareEmail } });
    if (!res.error) { Alert.alert('✅', s('share_success')); setShareEmail(''); openShare(sharePot); }
    else Alert.alert('Error', res.error || res.detail);
  };

  const doUnshare = async (email: string) => {
    if (!sharePot) return;
    await apiFetch(`/budgets/${sharePot.budget_id}/shared/${email}`, { method: 'DELETE', token });
    openShare(sharePot);
  };

  const shareStreak = async () => {
    if (!streak) return;
    const msg = lang === 'id'
      ? `🔥 Streak Boncos: ${streak.current_streak} hari berturut-turut! Longest: ${streak.longest_streak} hari. Anti boncos! 💪`
      : `🔥 Boncos Streak: ${streak.current_streak} days in a row! Longest: ${streak.longest_streak} days. Anti broke! 💪`;
    try { await Share.share({ message: msg }); } catch (e) { /* cancelled */ }
  };

  const handleLogout = () => Alert.alert(s('logout'), '', [{ text: s('cancel'), style: 'cancel' }, { text: s('logout'), style: 'destructive', onPress: logout }]);

  const sendContact = async () => {
    if (!contactMsg.trim()) return;
    setSendingMsg(true); Keyboard.dismiss();
    const res = await apiFetch('/contact', { method: 'POST', token, body: { message: contactMsg.trim() } });
    if (!res.error) { Alert.alert('✅', s('message_sent')); setContactMsg(''); setShowContact(false); }
    else Alert.alert('Error', res.error);
    setSendingMsg(false);
  };

  const exportCsv = async () => {
    if (planId !== 'V60') { setShowSubModal(true); return; }
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    const url = `${backendUrl}/api/export-csv`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Failed to export');
    }
  };

  const ownPots = pots.filter(p => !p.shared);
  const sharedPots = pots.filter(p => p.shared);
  const badge = user?.supporter_badge;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[st.scroll, { paddingTop: insets.top + 16, paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[st.title, { color: colors.text }]} testID="settings-title">{s('settings')}</Text>

        {/* User + badge */}
        {user && (
          <View style={[st.userCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[st.avatar, { backgroundColor: colors.statusAman, borderColor: colors.border }]}>
              <Text style={st.avatarText}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            <View style={st.userInfo}>
              <Text style={[st.userName, { color: colors.text }]}>{user.name}</Text>
              <Text style={[st.userEmail, { color: colors.textSecondary }]}>{user.email}</Text>
              {badge && <View style={[st.badgePill, { backgroundColor: colors.statusAman }]}><Text style={st.badgeText}>{badge}</Text></View>}
            </View>
          </View>
        )}

        {/* Streak + Share */}
        {streak && (
          <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={st.streakRow}>
              <Text style={[st.streakNum, { color: colors.statusAman }]}>🔥 {streak.current_streak}</Text>
              <Text style={[st.streakLabel, { color: colors.textSecondary }]}>{s('current_streak')}</Text>
              <TouchableOpacity testID="share-streak-btn" style={[st.shareBtn, { backgroundColor: colors.statusAman, borderColor: colors.border }]} onPress={shareStreak}>
                <Text style={st.shareBtnText}>{s('share_streak')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Subscription */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('current_plan')}: {PLAN_EMOJIS[planId] || ''} {planId}</Text>
        <TouchableOpacity testID="join-club-btn" style={[st.clubBtn, { backgroundColor: colors.statusAgakPanas, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={() => setShowSubModal(true)}>
          <Text style={st.clubBtnText}>{s('join_club')}</Text>
        </TouchableOpacity>

        {/* Own Budget Pots */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('budget_pots')} ({ownPots.length}/{planLimit === 999 ? '∞' : planLimit})</Text>
        {loadingPots ? <ActivityIndicator size="small" color={colors.statusAman} style={{ marginBottom: 16 }} /> : ownPots.length === 0 ? (
          <View style={[st.emptyPots, { borderColor: colors.border }]}><Text style={[st.emptyPotsText, { color: colors.textSecondary }]}>{s('no_pots')}</Text></View>
        ) : ownPots.map(pot => (
          <View key={pot.budget_id} testID={`pot-item-${pot.budget_id}`} style={[st.potItem, { backgroundColor: pot.is_locked ? colors.background : colors.card, borderColor: colors.border, shadowColor: colors.shadow, opacity: pot.is_locked ? 0.6 : 1 }]}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>{CATEGORIES.find(c => c.key === pot.category)?.icon || '💰'}</Text>
            <View style={st.potInfo}>
              <View style={st.potNameRow}>
                <Text style={[st.potLabel, { color: colors.text }]}>{pot.label}</Text>
                {pot.is_locked && <Text style={[st.lockIcon]}>🔒</Text>}
              </View>
              <Text style={[st.potBalance, { color: colors.textSecondary }]}>{fmtRp(pot.current_balance)} / {fmtRp(pot.total_balance)}</Text>
            </View>
            {pot.is_locked ? (
              <TouchableOpacity onPress={() => setShowSubModal(true)} style={st.potActionBtn}><Text style={{ fontSize: 12, color: colors.statusAgakPanas, fontWeight: '700' }}>{s('upgrade')}</Text></TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => openShare(pot)} style={st.potActionBtn}><Text style={{ fontSize: 16 }}>🔗</Text></TouchableOpacity>
                <TouchableOpacity testID={`edit-pot-${pot.budget_id}`} onPress={() => { setEditPot(pot); setEditBal(fmtInput(String(pot.total_balance))); setEditRef(pot.refill_date.split('T')[0]); setEditLabel(pot.label); }} style={st.potActionBtn}><Text style={{ fontSize: 16 }}>✏️</Text></TouchableOpacity>
                <TouchableOpacity testID={`delete-pot-${pot.budget_id}`} onPress={() => deletePot(pot.budget_id)} style={st.potActionBtn}><Text style={{ fontSize: 16 }}>❌</Text></TouchableOpacity>
              </>
            )}
          </View>
        ))}

        {/* Shared pots */}
        {sharedPots.length > 0 && (
          <>
            <Text style={[st.sectionTitle, { color: colors.text }]}>{s('shared_by')}</Text>
            {sharedPots.map(pot => (
              <View key={pot.budget_id} style={[st.potItem, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <Text style={{ fontSize: 20, marginRight: 10 }}>{CATEGORIES.find(c => c.key === pot.category)?.icon || '💰'}</Text>
                <View style={st.potInfo}>
                  <Text style={[st.potLabel, { color: colors.text }]}>{pot.label}</Text>
                  <Text style={[st.potBalance, { color: colors.textSecondary }]}>{s('shared_by')}: {pot.shared_by}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Add New Pot */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('add_pot')}</Text>
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.catScroll} contentContainerStyle={st.catRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity key={cat.key} testID={`cat-select-${cat.key}`} style={[st.catChip, { backgroundColor: selCat === cat.key ? colors.statusAman : colors.background, borderColor: colors.border }]} onPress={() => { setSelCat(cat.key); if (!label) setLabel(lang === 'id' ? cat.label_id : cat.label_en); }}>
                <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                <Text style={[st.catText, { color: selCat === cat.key ? '#111' : colors.text }]}>{lang === 'id' ? cat.label_id : cat.label_en}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('budget_label')}</Text>
          <TextInput testID="budget-label-input" style={[st.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={label} onChangeText={setLabel} />
          <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('total_balance')} (IDR)</Text>
          <View style={[st.balRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[st.balPre, { color: colors.textSecondary }]}>Rp</Text>
            <TextInput testID="budget-balance-input" style={[st.balInput, { color: colors.text }]} placeholder="3.000.000" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={balDisp} onChangeText={t => setBalDisp(fmtInput(t))} />
          </View>
          <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('refill_date')}</Text>
          <TextInput testID="budget-refill-date-input" style={[st.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder="2026-06-25" placeholderTextColor={colors.textSecondary} value={refDate} onChangeText={setRefDate} />
          <TouchableOpacity testID="save-budget-btn" style={[st.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={saveBudget} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#111" /> : <Text style={st.saveBtnText}>{s('save_budget')}</Text>}
          </TouchableOpacity>
        </View>

        {/* Language + Theme + Logout */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('language')}</Text>
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={st.toggleRow}>
            <TouchableOpacity testID="lang-id-btn" style={[st.toggleBtn, lang === 'id' && { backgroundColor: colors.statusAman }, { borderColor: colors.border }]} onPress={() => setLang('id')}>
              <Text style={[st.toggleText, { color: lang === 'id' ? '#111' : colors.text }]}>🇮🇩 Indonesia</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="lang-en-btn" style={[st.toggleBtn, lang === 'en' && { backgroundColor: colors.statusAman }, { borderColor: colors.border }]} onPress={() => setLang('en')}>
              <Text style={[st.toggleText, { color: lang === 'en' ? '#111' : colors.text }]}>🇺🇸 English</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('theme')}</Text>
        <TouchableOpacity testID="toggle-theme-btn" style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={toggleTheme}>
          <Text style={{ fontSize: 20 }}>{mode === 'dark' ? '🌙' : '☀️'}</Text>
          <Text style={[st.toggleText, { color: colors.text, flex: 1 }]}>{mode === 'dark' ? s('dark_mode') : s('light_mode')}</Text>
          <Text style={{ fontSize: 16 }}>🔄</Text>
        </TouchableOpacity>

        {/* Export CSV (V60 only) */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('export_csv')}</Text>
        <TouchableOpacity testID="export-csv-btn" style={[st.card, { backgroundColor: planId === 'V60' ? colors.statusAman : colors.card, borderColor: colors.border, shadowColor: colors.shadow, flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={exportCsv}>
          <Text style={{ fontSize: 20 }}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={[st.toggleText, { color: planId === 'V60' ? '#111' : colors.text }]}>{s('export_csv')}</Text>
            {planId !== 'V60' && <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>👑 {s('export_v60_only')}</Text>}
          </View>
        </TouchableOpacity>

        {/* Contact Us */}
        <Text style={[st.sectionTitle, { color: colors.text }]}>{s('contact_us')}</Text>
        <TouchableOpacity testID="contact-us-btn" style={[st.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, flexDirection: 'row', alignItems: 'center', gap: 12 }]} onPress={() => setShowContact(true)}>
          <Text style={{ fontSize: 20 }}>💬</Text>
          <Text style={[st.toggleText, { color: colors.text, flex: 1 }]}>{s('contact_us')}</Text>
        </TouchableOpacity>

        {/* Offline warning */}
        {isOffline && (
          <View style={[st.offlineBanner, { borderColor: colors.statusBoncos }]}>
            <Text style={[st.offlineText, { color: colors.statusBoncos }]}>{s('offline_warning')}</Text>
          </View>
        )}

        <TouchableOpacity testID="logout-btn" style={[st.logoutBtn, { backgroundColor: colors.statusBoncos, borderColor: colors.border, shadowColor: colors.shadow }]} onPress={handleLogout}>
          <Text style={st.logoutText}>🚪 {s('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Subscription Modal */}
      <Modal visible={showSubModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBg} onPress={() => setShowSubModal(false)} />
          <View style={[st.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.modalHandle} />
            <Text style={[st.modalTitle, { color: colors.text }]}>{s('join_club')} ☕</Text>
            {plans.filter(p => p.id !== 'FREE').map(p => (
              <TouchableOpacity key={p.id} testID={`plan-${p.id}`} style={[st.planCard, { backgroundColor: planId === p.id ? colors.statusAman : colors.background, borderColor: colors.border }]} onPress={() => subscribe(p.id)} disabled={!!subbing}>
                <View style={st.planInfo}>
                  <Text style={[st.planName, { color: planId === p.id ? '#111' : colors.text }]}>{PLAN_EMOJIS[p.id]} {p.displayName}</Text>
                  {p.badgeName && <Text style={[st.planBadge, { color: planId === p.id ? '#111' : colors.textSecondary }]}>{p.badgeName}</Text>}
                  <Text style={[st.planBenefit, { color: planId === p.id ? '#111' : colors.textSecondary }]}>{p.isUnlimited ? 'Unlimited pot' : `Max ${p.maxBudgetPots} pot`}</Text>
                </View>
                <Text style={[st.planPrice, { color: planId === p.id ? '#111' : colors.text }]}>{p.priceLabel}</Text>
                {subbing === p.id && <ActivityIndicator size="small" color="#111" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[st.cancelBtn2, { borderColor: colors.border }]} onPress={() => setShowSubModal(false)}>
              <Text style={[st.cancelBtnText2, { color: colors.text }]}>{s('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editPot} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBg} onPress={() => { setEditPot(null); Keyboard.dismiss(); }} />
          <View style={[st.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.modalHandle} />
            <Text style={[st.modalTitle, { color: colors.text }]}>{s('edit_budget')}</Text>
            <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('budget_label')}</Text>
            <TextInput testID="edit-label-input" style={[st.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editLabel} onChangeText={setEditLabel} />
            <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('new_total')} (IDR)</Text>
            <View style={[st.balRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[st.balPre, { color: colors.textSecondary }]}>Rp</Text>
              <TextInput testID="edit-balance-input" style={[st.balInput, { color: colors.text }]} keyboardType="numeric" value={editBal} onChangeText={t => setEditBal(fmtInput(t))} />
            </View>
            <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('refill_date')}</Text>
            <TextInput testID="edit-refill-input" style={[st.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} value={editRef} onChangeText={setEditRef} />
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.cancelBtn2, { borderColor: colors.border, flex: 1 }]} onPress={() => setEditPot(null)}><Text style={[st.cancelBtnText2, { color: colors.text }]}>{s('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity testID="save-edit-btn" style={[st.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow, flex: 1 }]} onPress={saveEdit} disabled={editSaving}>
                {editSaving ? <ActivityIndicator size="small" color="#111" /> : <Text style={st.saveBtnText}>{s('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Modal */}
      <Modal visible={!!sharePot} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBg} onPress={() => setSharePot(null)} />
          <View style={[st.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.modalHandle} />
            <Text style={[st.modalTitle, { color: colors.text }]}>{s('share_budget')}: {sharePot?.label}</Text>
            <View style={[st.balRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>📧</Text>
              <TextInput style={[st.balInput, { color: colors.text }]} placeholder={s('share_with_email')} placeholderTextColor={colors.textSecondary} value={shareEmail} onChangeText={setShareEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, marginTop: 8 }]} onPress={doShare}>
              <Text style={st.saveBtnText}>{s('share_budget')}</Text>
            </TouchableOpacity>
            {sharedWith.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[st.inputLabel, { color: colors.textSecondary }]}>{s('shared_with')}</Text>
                {sharedWith.map(email => (
                  <View key={email} style={[st.sharedRow, { borderColor: colors.border }]}>
                    <Text style={[{ color: colors.text, flex: 1, fontSize: 14 }]}>{email}</Text>
                    <TouchableOpacity onPress={() => doUnshare(email)}><Text style={{ color: colors.statusBoncos, fontWeight: '700', fontSize: 13 }}>{s('unshare')}</Text></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity style={[st.cancelBtn2, { borderColor: colors.border, marginTop: 12 }]} onPress={() => setSharePot(null)}>
              <Text style={[st.cancelBtnText2, { color: colors.text }]}>{s('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Contact Us Modal */}
      <Modal visible={showContact} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={st.modalOverlay}>
          <TouchableOpacity style={st.modalBg} onPress={() => { setShowContact(false); Keyboard.dismiss(); }} />
          <View style={[st.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={st.modalHandle} />
            <Text style={[st.modalTitle, { color: colors.text }]}>💬 {s('contact_us')}</Text>
            <TextInput testID="contact-message-input" style={[st.contactInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} placeholder={s('contact_placeholder')} placeholderTextColor={colors.textSecondary} multiline numberOfLines={5} textAlignVertical="top" value={contactMsg} onChangeText={setContactMsg} />
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.cancelBtn2, { borderColor: colors.border, flex: 1 }]} onPress={() => setShowContact(false)}>
                <Text style={[st.cancelBtnText2, { color: colors.text }]}>{s('close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="send-contact-btn" style={[st.saveBtn, { backgroundColor: colors.statusAman, borderColor: colors.border, shadowColor: colors.shadow, flex: 1 }]} onPress={sendContact} disabled={sendingMsg || !contactMsg.trim()}>
                {sendingMsg ? <ActivityIndicator size="small" color="#111" /> : <Text style={st.saveBtnText}>{s('send')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginBottom: 20 },
  userCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 16, padding: 16, marginBottom: 20, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  avatar: { width: 48, height: 48, borderRadius: 14, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  avatarText: { fontSize: 20, fontWeight: '900', color: '#111' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },
  badgePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#111' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakNum: { fontSize: 24, fontWeight: '900' },
  streakLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  shareBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 2 },
  shareBtnText: { fontSize: 13, fontWeight: '700', color: '#111' },
  clubBtn: { borderWidth: 3, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 20, shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  clubBtnText: { fontSize: 16, fontWeight: '900', color: '#111' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 4, letterSpacing: -0.5 },
  emptyPots: { borderWidth: 2, borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 20, borderStyle: 'dashed' },
  emptyPotsText: { fontSize: 14, fontWeight: '600' },
  potItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 14, padding: 12, marginBottom: 10, shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0, elevation: 3 },
  potInfo: { flex: 1 },
  potNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  potLabel: { fontSize: 15, fontWeight: '700' },
  lockIcon: { fontSize: 14 },
  potBalance: { fontSize: 12, marginTop: 2 },
  potActionBtn: { padding: 6, marginLeft: 2 },
  card: { borderWidth: 2, borderRadius: 16, padding: 16, marginBottom: 20, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  balRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16 },
  balPre: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  balInput: { flex: 1, fontSize: 20, fontWeight: '700', paddingVertical: 14 },
  catScroll: { marginBottom: 16 },
  catRow: { gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
  catText: { fontSize: 13, fontWeight: '700' },
  saveBtn: { borderWidth: 3, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#111' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  toggleText: { fontSize: 15, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 3, borderRadius: 14, paddingVertical: 16, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 3, borderBottomWidth: 0, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn2: { borderWidth: 2, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText2: { fontSize: 15, fontWeight: '700' },
  planCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 10 },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '800' },
  planBadge: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  planBenefit: { fontSize: 11, marginTop: 2 },
  planPrice: { fontSize: 14, fontWeight: '800' },
  sharedRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 8 },
  contactInput: { borderWidth: 2, borderRadius: 12, padding: 14, fontSize: 15, fontWeight: '500', marginBottom: 16, minHeight: 120 },
  offlineBanner: { borderWidth: 2, borderRadius: 12, padding: 12, marginBottom: 16, borderStyle: 'dashed' },
  offlineText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
