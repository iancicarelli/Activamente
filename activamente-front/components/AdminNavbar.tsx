import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";

type Active = "home" | "users" | "profile";

type Props = {
  active: Active;
};

export default function AdminNavbar({ active }: Props) {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  const colorFor = (key: Active) =>
    active === key ? "#27695A" : "rgba(39, 105, 90, 0.35)";

  return (
    <View style={styles.bar}>
      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push("/admin-main" as any)}
      >
        <MaterialCommunityIcons name="home-outline" size={28} color={colorFor("home")} />
        <Text style={[styles.label, { color: colorFor("home") }]}>Inicio</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/admin-users" as any)}>
        <MaterialCommunityIcons
          name="account-group-outline"
          size={28}
          color={colorFor("users")}
        />
        <Text style={[styles.label, { color: colorFor("users") }]}>Usuarios</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.item} onPress={() => router.push("/admin-profile" as any)}>
        <MaterialCommunityIcons
          name="account-outline"
          size={28}
          color={colorFor("profile")}
        />
        <Text style={[styles.label, { color: colorFor("profile") }]}>Perfil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 70,
    backgroundColor: "transparent",
    paddingBottom: Platform.OS === "ios" ? 10 : 0,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: "PromptRegular",
    marginTop: 2,
  },
});
