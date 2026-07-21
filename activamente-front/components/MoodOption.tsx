import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useFonts } from "expo-font";

interface MoodOptionProps {
    label: string;
    icon: keyof typeof FontAwesome.glyphMap;
    color: string;
    onPress: () => void;
    selected?: boolean;
}

export default function MoodOption({ label, icon, color, onPress, selected }: MoodOptionProps) {
    const [fontsLoaded] = useFonts({
        PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
        PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
    });
    if (!fontsLoaded) return null;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            style={[
                styles.button,
                { backgroundColor: color },
                selected && styles.selected,
            ]}
            onPress={onPress}
        >
            <View style={styles.iconWrap}>
                <FontAwesome name={icon} size={52} color="#27695A" />
            </View>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: "30%",
        minHeight: 130,
        marginBottom: 14,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        paddingHorizontal: 6,
        borderWidth: 3,
        borderColor: "transparent",
    },
    selected: {
        borderColor: "#27695A",
        transform: [{ scale: 1.04 }],
    },
    iconWrap: {
        marginBottom: 8,
    },
    label: {
        color: "#27695A",
        fontSize: 18,
        fontFamily: "PromptBold",
        textAlign: "center",
    },
});
