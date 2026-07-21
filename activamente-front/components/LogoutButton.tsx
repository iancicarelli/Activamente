import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useFonts } from "expo-font";

type Props = {
  onPress: () => void;
};

export default function LogoutButton({ onPress }: Props) {
    const [fontsLoaded] = useFonts({
        PromptRegular: require("../assets/fonts/Prompt-Regular.ttf"),
        PromptBold: require("../assets/fonts/Prompt-SemiBold.ttf"),
    });
    if (!fontsLoaded) return null;

    return (
        <TouchableOpacity style={styles.button} onPress={onPress}>
            <Text style={styles.text}>Cerrar Sesión</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E75756",
        padding: 10,
        borderRadius: 20,
        marginTop: 5,
        width: 270,
        height: 60,
        marginLeft: 55,
    },
    text: {
        color: "#DEEDE6",
        fontSize: 20,
        marginLeft: 10,
        fontFamily: 'PromptRegular',
    },
});