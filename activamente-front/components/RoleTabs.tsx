// components/RoleTabs.tsx — Tabs de expo-router con el estilo de la app.
// `big` = escala paciente (UX-19: etiquetas grandes, íconos rellenos activos).
import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "../constants/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export type TabDef = { name: string; title: string; icon: IconName; iconActive: IconName };

export function RoleTabs({ tabs, big }: { tabs: TabDef[]; big?: boolean }) {
  const insets = useSafeAreaInsets();
  const height = (big ? 86 : 70) + insets.bottom;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.textPrimary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          height,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
          backgroundColor: Colors.cardBg,
          borderTopColor: Colors.divider,
        },
        tabBarLabelStyle: { fontFamily: Fonts.bold, fontSize: big ? 16 : 12 },
        tabBarIconStyle: big ? { marginBottom: 2 } : undefined,
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, focused }) => (
              <MaterialCommunityIcons name={focused ? t.iconActive : t.icon} size={big ? 34 : 28} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
