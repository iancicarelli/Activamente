import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Colors, Fonts, FontSize, Radius, Touch } from "../../constants/theme";

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="magnify" size={22} color={Colors.textPrimary} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={placeholder}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: Touch.staff,
    marginBottom: 14,
    borderColor: Colors.border,
    borderWidth: 1,
    backgroundColor: Colors.cardBgAlt,
  },
  input: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.regular, color: Colors.textPrimary, paddingVertical: 8 },
});
