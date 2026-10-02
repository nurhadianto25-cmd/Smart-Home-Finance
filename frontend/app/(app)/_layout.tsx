import { Stack } from "expo-router";
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="menu" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="belanja" />
      <Stack.Screen name="laporan" />
      <Stack.Screen name="analisis" />
      <Stack.Screen name="pengaturan" />
      <Stack.Screen name="add-transaction" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
    </Stack>
  );
}
