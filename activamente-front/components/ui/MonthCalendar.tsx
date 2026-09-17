// components/ui/MonthCalendar.tsx — calendario mensual compartido por el
// calendario del especialista y por "Agendar hora" (UX-06).
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize } from "../../constants/theme";
import { buildCalendar, monthTitle } from "../../utils/dates";

const DAYS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

type Props = {
  year: number;
  month: number; // 0-11
  selected: string | null; // YYYY-MM-DD
  onSelect: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  // Días con puntito (p.ej. citas). Clave YYYY-MM-DD → cantidad.
  marks?: Record<string, number>;
  // Bloquea días anteriores a esta fecha (YYYY-MM-DD).
  minDate?: string;
  todayIso?: string;
};

export function MonthCalendar({ year, month, selected, onSelect, onPrevMonth, onNextMonth, marks = {}, minDate, todayIso }: Props) {
  const weeks = buildCalendar(year, month);
  return (
    <View style={styles.card}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={onPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Mes anterior" accessibilityRole="button">
          <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthTitle(year, month)}</Text>
        <TouchableOpacity onPress={onNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Mes siguiente" accessibilityRole="button">
          <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {DAYS_ES.map((d) => (
          <Text key={d} style={styles.dayHeader}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((cell) => {
            const disabled = !cell.inMonth || (!!minDate && cell.iso < minDate);
            const isSelected = cell.iso === selected;
            const isToday = cell.iso === todayIso;
            const count = marks[cell.iso] ?? 0;
            return (
              <TouchableOpacity
                key={cell.iso}
                style={[styles.cell, isSelected && styles.cellSelected, isToday && !isSelected && styles.cellToday]}
                onPress={() => !disabled && onSelect(cell.iso)}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${cell.day}${count ? `, ${count} citas` : ""}`}
                accessibilityState={{ disabled, selected: isSelected }}
              >
                <Text style={[styles.cellText, disabled && styles.cellGray, isSelected && styles.cellTextSelected]}>{cell.day}</Text>
                {count > 0 && cell.inMonth ? <View style={[styles.dot, isSelected && { backgroundColor: Colors.textOnDark }]} /> : <View style={styles.dotPlaceholder} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(222,237,230,0.9)", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  monthLabel: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.textPrimary },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  dayHeader: { flex: 1, textAlign: "center", fontSize: FontSize.xs, fontFamily: Fonts.bold, color: Colors.textSecondary, paddingBottom: 6 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 20, minHeight: 44 },
  cellSelected: { backgroundColor: Colors.textPrimary },
  cellToday: { borderWidth: 1.5, borderColor: Colors.btnTeal },
  cellText: { fontSize: FontSize.sm, fontFamily: Fonts.regular, color: Colors.textPrimary },
  cellGray: { color: "rgba(39, 105, 90, 0.3)" },
  cellTextSelected: { color: Colors.textOnDark, fontFamily: Fonts.bold },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.btnTeal, marginTop: 3 },
  dotPlaceholder: { width: 6, height: 6, marginTop: 3 },
});
