import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { Colors, Radius, Spacing } from "../../constants/theme";

type Props = ViewProps & { alt?: boolean; bordered?: boolean; padded?: boolean };

export function Card({ alt, bordered = true, padded = true, style, ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        alt && { backgroundColor: Colors.cardBgAlt },
        bordered && styles.bordered,
        padded && { padding: Spacing.lg },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, marginBottom: Spacing.md },
  bordered: { borderWidth: 1, borderColor: Colors.border },
});
