import { Stack } from 'expo-router';
import { AppLanguageProvider } from '../AppLanguage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function RootLayout() {
  return <SafeAreaProvider><AppLanguageProvider><Stack screenOptions={{headerShown:false}}><Stack.Screen name="(tabs)"/><Stack.Screen name="prashnavali" options={{gestureEnabled:false}}/><Stack.Screen name="prashnavali-info"/></Stack></AppLanguageProvider></SafeAreaProvider>;
}
