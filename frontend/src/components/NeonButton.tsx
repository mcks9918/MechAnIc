import React from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Colors, Radius } from "../theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  testID?: string;
};

export function NeonButton({ title, onPress, variant = "primary", loading, disabled, style, textStyle, testID }: Props) {
  const isPrimary = variant === "primary";
  const isGhost = variant === "ghost";
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        isPrimary && styles.primary,
        variant === "secondary" && styles.secondary,
        isGhost && styles.ghost,
        (disabled || loading) && styles.disabled,
        style as any,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#000" : Colors.neon} />
      ) : (
        <Text style={[styles.txt, isPrimary ? styles.txtPrimary : styles.txtNeon, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: Colors.neon,
    shadowColor: Colors.neon,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.neon,
    backgroundColor: "rgba(0,240,255,0.06)",
  },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
  txt: { fontSize: 14, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  txtPrimary: { color: "#000" },
  txtNeon: { color: Colors.neon },
});
