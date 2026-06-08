import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  colors: {
    background: string;
    card: string;
    border: string;
    text: string;
    textSecondary: string;
    statusAman: string;
    shadow?: string;
  };
  testID?: string;
  placeholder?: string;
  todayLabel?: string;
  doneLabel?: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(value: string) {
  const date = parseDateInput(value);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function DatePickerField({
  value,
  onChange,
  colors,
  testID,
  placeholder = 'Pilih tanggal',
  todayLabel = 'Hari ini',
  doneLabel = 'Selesai',
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = parseDateInput(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const selectedDate = parseDateInput(value);
  const calendarDays = useMemo(() => {
    const firstDay = visibleMonth.getDay();
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleMonth]);

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const chooseDate = (date: Date) => {
    onChange(toDateInputValue(date));
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={[styles.field, { backgroundColor: colors.background, borderColor: colors.border }]}
        onPress={() => {
          const date = parseDateInput(value);
          setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          setOpen(true);
        }}
        activeOpacity={0.75}
      >
        <Text style={[styles.fieldText, { color: colors.text }]}>{value ? formatDisplayDate(value) : placeholder}</Text>
        <Text style={[styles.chevron, { color: colors.textSecondary }]}>v</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.header}>
              <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => moveMonth(-1)}>
                <Text style={[styles.navText, { color: colors.text }]}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </Text>
              <TouchableOpacity style={[styles.navBtn, { borderColor: colors.border }]} onPress={() => moveMonth(1)}>
                <Text style={[styles.navText, { color: colors.text }]}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {DAYS.map((day) => (
                <Text key={day} style={[styles.weekText, { color: colors.textSecondary }]}>{day}</Text>
              ))}
            </View>
            <View style={styles.grid}>
              {calendarDays.map((date, index) => {
                const active = !!date && toDateInputValue(date) === toDateInputValue(selectedDate);
                return (
                  <TouchableOpacity
                    key={date ? toDateInputValue(date) : `blank-${index}`}
                    style={[
                      styles.dayCell,
                      active && { backgroundColor: colors.statusAman, borderColor: colors.border },
                    ]}
                    disabled={!date}
                    onPress={() => date && chooseDate(date)}
                  >
                    <Text style={[styles.dayText, { color: active ? '#111' : colors.text }]}>{date ? date.getDate() : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.todayBtn, { borderColor: colors.border }]} onPress={() => chooseDate(new Date())}>
                <Text style={[styles.todayText, { color: colors.text }]}>{todayLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.statusAman, borderColor: colors.border }]} onPress={() => setOpen(false)}>
                <Text style={styles.doneText}>{doneLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldText: { fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 14, fontWeight: '900' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 3,
    borderRadius: 18,
    padding: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 38, height: 38, borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 20, fontWeight: '900' },
  monthTitle: { fontSize: 17, fontWeight: '900' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 0,
  },
  dayText: { fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  todayBtn: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  todayText: { fontSize: 14, fontWeight: '800' },
  doneBtn: { flex: 1, borderWidth: 2, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  doneText: { fontSize: 14, fontWeight: '900', color: '#111' },
});
