import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { Colors, Radius } from "../theme";

export function GlassCard({ children, style, glow }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; glow?: boolean }) {
  return (
    <View style={[styles.card, glow && styles.glow, style as any]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceSolid,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  inner: { padding: 16 },
  glow: {
    borderColor: Colors.neonDim,
    shadowColor: Colors.neon,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
});
