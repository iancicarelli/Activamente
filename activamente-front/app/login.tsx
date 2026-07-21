// app/login.tsx
// Kept so the "/login" route still resolves (e.g. after logout). Both "/" and
// "/login" render the same screen.
import LoginScreen from "../screens/LoginScreen";

export default function Login() {
  return <LoginScreen />;
}
