import React, { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { Colors, Radius } from "../src/theme";
import { NeonButton } from "../src/components/NeonButton";
import { Scanlines } from "../src/components/Scanlines";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Required", "Email and password are required");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, fullName.trim() || undefined);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Authentication failed", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Scanlines />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>◆ MechAnIc</Text>
            <Text style={styles.tag}>{mode === "login" ? "ACCESS GRANTED" : "INITIALIZE PROFILE"}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <TouchableOpacity testID="tab-login" onPress={() => setMode("login")} style={[styles.tab, mode === "login" && styles.tabActive]}>
                <Text style={[styles.tabTxt, mode === "login" && styles.tabTxtActive]}>LOGIN</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="tab-signup" onPress={() => setMode("signup")} style={[styles.tab, mode === "signup" && styles.tabActive]}>
                <Text style={[styles.tabTxt, mode === "signup" && styles.tabTxtActive]}>SIGN UP</Text>
              </TouchableOpacity>
            </View>

            {mode === "signup" && (
              <TextInput
                testID="input-fullname"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name (optional)"
                placeholderTextColor={Colors.textTertiary}
                style={styles.input}
              />
            )}
            <TextInput
              testID="input-email"
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              testID="input-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              style={styles.input}
            />

            <NeonButton
              testID="auth-submit"
              title={busy ? "..." : mode === "login" ? "Enter Garage" : "Create Account"}
              onPress={submit}
              loading={busy}
              style={{ marginTop: 12 }}
            />

            <Text style={styles.hint}>
              {mode === "login" ? "New mechanic? " : "Already have an account? "}
              <Text style={styles.hintLink} onPress={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Sign up" : "Log in"}
              </Text>
            </Text>
          </View>

          {busy && <ActivityIndicator color={Colors.neon} style={{ marginTop: 12 }} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingTop: 40, gap: 24 },
  header: { alignItems: "center", marginBottom: 8 },
  logo: { color: Colors.neon, fontSize: 32, fontWeight: "800", letterSpacing: 5, textShadowColor: Colors.neonGlow, textShadowRadius: 12 },
  tag: { color: Colors.textSecondary, fontSize: 11, letterSpacing: 3, marginTop: 6, fontWeight: "600" },
  card: { backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.lg, padding: 20, gap: 12 },
  tabs: { flexDirection: "row", backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 4, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: Radius.sm },
  tabActive: { backgroundColor: Colors.neonDim, borderWidth: 1, borderColor: Colors.neon },
  tabTxt: { color: Colors.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  tabTxtActive: { color: Colors.neon },
  input: {
    backgroundColor: Colors.bg,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  hint: { color: Colors.textSecondary, textAlign: "center", marginTop: 10, fontSize: 13 },
  hintLink: { color: Colors.neon, fontWeight: "700" },
});
