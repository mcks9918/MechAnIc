import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { Colors } from "../src/theme";
import { Scanlines } from "../src/components/Scanlines";

export default function Splash() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        router.replace(user ? "/(tabs)" : "/auth");
      }, 600);
    }
  }, [loading, user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Scanlines />
      <View style={styles.brandWrap}>
        <Text style={styles.logo}>◆ MechAnIc</Text>
        <Text style={styles.tag}>AI MECHANIC · PARTS RADAR</Text>
        <View style={styles.divider} />
        <ActivityIndicator color={Colors.neon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  brandWrap: { alignItems: "center", gap: 14 },
  logo: { color: Colors.neon, fontSize: 36, fontWeight: "800", letterSpacing: 6, textShadowColor: Colors.neonGlow, textShadowRadius: 16 },
  tag: { color: Colors.textSecondary, fontSize: 11, letterSpacing: 4, fontWeight: "600" },
  divider: { width: 80, height: 1, backgroundColor: Colors.neonDim, marginVertical: 6 },
});
