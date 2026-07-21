import { TextInput, StyleSheet, View, Text } from 'react-native';
import { useFonts } from 'expo-font';

interface CustomInputProps {
  label: string;
  [key: string]: any;
}

export function CustomInput({ label, ...props }: CustomInputProps) {
  const [fontsLoaded] = useFonts({
    PromptRegular: require('../../../assets/fonts/Prompt-Regular.ttf'),
    PromptBold: require('../../../assets/fonts/Prompt-SemiBold.ttf'),
  });
  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontFamily: 'PromptRegular', fontSize: 16, marginBottom: 8, color: '#333' },
  input: {
    backgroundColor: '#e0e9e8', // Color del fondo de los inputs en tu imagen
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  }
});