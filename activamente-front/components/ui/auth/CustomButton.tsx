import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';

export function CustomButton({ title, onPress, loading }: { title: string; onPress: () => void; loading: boolean }) {
  const [fontsLoaded] = useFonts({
    PromptRegular: require('../../../assets/fonts/Prompt-Regular.ttf'),
    PromptBold: require('../../../assets/fonts/Prompt-SemiBold.ttf'),
  });
  if (!fontsLoaded) return null;

  return (
    <TouchableOpacity
      style={[styles.button, loading && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#dce775', // Color verde claro de tu botón
    padding: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  text: { fontFamily: 'PromptBold', fontSize: 16 }
});