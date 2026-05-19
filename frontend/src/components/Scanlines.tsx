import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme";

// Subtle horizontal scanline overlay for futuristic HUD feel.
export function Scanlines() {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {Array.from({ length: 80 }).map((_, i) => (
        <View key={i} style={styles.line} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.08,
  },
  line: { height: 2, backgroundColor: Colors.neon, marginBottom: 6 },
});
