import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "../lib/auth";
import { C } from "../lib/theme";

export default function Index() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    const role = (session?.user as any)?.role;
    if (!session) {
      router.replace("/sign-in");
    } else if (role === "rider" || role === "admin") {
      router.replace("/(rider)");
    } else {
      // customers aren't part of the tech app
      router.replace("/sign-in");
    }
  }, [
	isPending,
	session,
	router
]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.brand} size="large" />
    </View>
  );
}
