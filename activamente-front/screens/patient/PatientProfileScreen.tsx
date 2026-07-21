import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import PatientNavbar from '../../components/PatientNavbar';
import { getSession } from '../../services/authStore';


export default function PatientProfileScreen() {
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [fontsLoaded] = useFonts({
        PromptRegular: require("../../assets/fonts/Prompt-Regular.ttf"),
        PromptBold: require("../../assets/fonts/Prompt-SemiBold.ttf"),
    });

    if (!fontsLoaded) {
        return null;
    }

    const session = getSession();
    const patient = session?.patient;

    console.log("Paciente en sesión:", patient);

    return (
        <LinearGradient colors={["#DEEDE6", "#90C0C1"]} style={styles.container}>
            <View style={styles.banner}>
                <Text style={styles.bannerTitle}>Mi Perfil</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.contact}>
                    <MaterialCommunityIcons name="account-circle-outline" size={60} color="#27695A" />
                    <View style={styles.textBlock}>
                        <Text style={styles.name}>{patient?.fullName}</Text>
                        <Text style={styles.name}>{patient?.age} Años</Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Información del contacto</Text>
                <View style={styles.contact_info}>
                    <View style={styles.item}>
                        <MaterialCommunityIcons name="email-outline" size={30} color="#27695A" />
                        <View style={styles.textBlock}>
                            <Text style={styles.name_contact}>Correo Electrónico</Text>
                            <Text style={styles.name_contact}>{patient?.email}</Text>
                        </View>
                    </View>
                    <View style={styles.item}>
                        <MaterialCommunityIcons name="phone-outline" size={30} color="#27695A" />
                        <View style={styles.textBlock}>
                            <Text style={styles.name_contact}>Teléfono</Text>
                            <Text style={styles.name_contact}>{patient?.phone}</Text>
                        </View>
                    </View>
                    <View style={styles.item}>
                        <MaterialCommunityIcons name="map-marker-outline" size={30} color="#27695A" />
                        <View style={styles.textBlock}>
                            <Text style={styles.name_contact}>Dirección</Text>
                            <Text style={styles.name_contact}>{patient?.address}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Mi profesional de salud</Text>
                <View style={styles.contact_info}>
                    <View style={styles.item}>
                        <MaterialCommunityIcons name="account-circle-outline" size={60} color="#27695A" />
                        <View style={styles.textBlock}>
                            <Text style={styles.name}>Dr Carlos Fernández</Text>
                            <Text style={styles.name}>38 años</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <PatientNavbar active="profile" />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    banner: {
        width: '100%',
        backgroundColor: '#49A2A5',
        paddingTop: 50,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    bannerTitle: {
        fontSize: 24,
        fontFamily: 'PromptBold',
        color: '#DEEDE6',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 16,
        paddingBottom: 24,
    },
    sectionLabel: {
        fontSize: 18,
        fontFamily: 'PromptBold',
        color: '#27695A',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    textBlock: {
        marginLeft: 10,
        flex: 1,
    },
    contact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 2,
        borderRadius: 20,
        borderColor: '#49A2A5',
        backgroundColor: '#DEEDE6',
        marginHorizontal: 16,
        marginTop: 16,
    },
    contact_info: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderRadius: 20,
        padding: 20,
        borderColor: '#49A2A5',
        backgroundColor: '#DEEDE6',
    },
    name_contact: {
        fontSize: 16,
        marginLeft: 10,
        fontFamily: 'PromptRegular',
        color: '#27695A',
    },
    name: {
        fontSize: 20,
        marginLeft: 10,
        fontFamily: 'PromptRegular',
        color: '#27695A',
    },
});
