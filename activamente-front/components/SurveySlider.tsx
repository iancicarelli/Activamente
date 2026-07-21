import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import { useFonts } from "expo-font";

export default function SurveySlider({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    const [fontsLoaded] = useFonts({
        PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
        PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
    });
    if (!fontsLoaded) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.valueBadge}>
                    <Text style={styles.valueBadgeText}>{value}</Text>
                </View>
            </View>
            <Slider
                style={{ width: "100%", height: 44 }}
                value={value}
                onValueChange={onChange}
                minimumValue={1}
                maximumValue={10}
                step={1}
                minimumTrackTintColor="#49A2A5"
                maximumTrackTintColor="rgba(39, 105, 90, 0.25)"
                thumbTintColor="#27695A"
            />
            <View style={styles.scale}>
                {Array.from({ length: 10 }, (_, i) => {
                    const n = i + 1;
                    return (
                        <Text key={n} style={[styles.number, n === value && styles.activeNumber]}>
                            {n}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 14,
        backgroundColor: '#DEEDE6',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#49A2A5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    label: {
        fontSize: 20,
        fontFamily: "PromptBold",
        color: '#27695A',
        flex: 1,
    },
    valueBadge: {
        backgroundColor: '#49A2A5',
        minWidth: 48,
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueBadgeText: {
        fontSize: 20,
        fontFamily: 'PromptBold',
        color: '#DEEDE6',
    },
    scale: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 4,
    },
    number: {
        fontSize: 16,
        fontFamily: "PromptRegular",
        color: 'rgba(39, 105, 90, 0.55)',
    },
    activeNumber: {
        fontSize: 20,
        fontFamily: "PromptBold",
        color: "#27695A",
    },
});
