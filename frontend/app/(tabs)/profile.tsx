import React, { useCallback, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "../../src/components/Ionicons";
import { api, Vehicle } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Colors, Radius } from "../../src/theme";
import { NeonButton } from "../../src/components/NeonButton";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setVehicles(await api.vehicles()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addVehicle = async () => {
    const y = parseInt(year, 10);
    if (!make.trim() || !model.trim() || !y || y < 1900) {
      Alert.alert("Required", "Make, model and a valid year are required.");
      return;
    }
    setBusy(true);
    try {
      await api.addVehicle({ make: make.trim(), model: model.trim(), year: y, nickname: nickname.trim() || undefined });
      setMake(""); setModel(""); setYear(""); setNickname("");
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Try again");
    } finally { setBusy(false); }
  };

  const remove = (id: string) => {
    Alert.alert("Remove vehicle?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.deleteVehicle(id); await load(); } catch (e: any) { Alert.alert("Failed", e?.message); }
      }},
    ]);
  };

  const doLogout = async () => {
    await logout();
    router.replace("/auth");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.title}>◆ PROFILE</Text>
            <Text style={styles.sub}>{user?.email}</Text>
          </View>

          <Text style={styles.section}>YOUR GARAGE</Text>
          {vehicles.length === 0 && <Text style={styles.empty}>No vehicles yet. Add your first below.</Text>}
          {vehicles.map((v) => (
            <View key={v.id} style={styles.vCard}>
              <Ionicons name="car-sport-outline" size={24} color={Colors.neon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vTitle}>{v.year} {v.make} {v.model}</Text>
                {v.nickname && <Text style={styles.vSub}>{v.nickname}</Text>}
              </View>
              <TouchableOpacity testID={`delete-vehicle-${v.id}`} onPress={() => remove(v.id)}>
                <Ionicons name="trash-outline" size={18} color={Colors.red} />
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.section}>ADD VEHICLE</Text>
          <View style={styles.formCard}>
            <View style={styles.row}>
              <TextInput testID="input-make" value={make} onChangeText={setMake} placeholder="Make (Toyota)" placeholderTextColor={Colors.textTertiary} style={[styles.input, { flex: 1 }]} />
              <TextInput testID="input-year" value={year} onChangeText={setYear} placeholder="Year" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" style={[styles.input, { width: 90 }]} />
            </View>
            <TextInput testID="input-model" value={model} onChangeText={setModel} placeholder="Model (Camry)" placeholderTextColor={Colors.textTertiary} style={styles.input} />
            <TextInput testID="input-nickname" value={nickname} onChangeText={setNickname} placeholder="Nickname (optional)" placeholderTextColor={Colors.textTertiary} style={styles.input} />
            <NeonButton testID="add-vehicle-btn" title="Add to Garage" onPress={addVehicle} loading={busy} />
          </View>

          <NeonButton testID="logout-btn" title="Sign Out" variant="secondary" onPress={doLogout} style={{ marginTop: 8 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  title: { color: Colors.neon, fontSize: 18, fontWeight: "800", letterSpacing: 3 },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  section: { color: Colors.textTertiary, fontSize: 11, letterSpacing: 2.5, fontWeight: "700", marginTop: 8 },
  vCard: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md },
  vTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  vSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { color: Colors.textTertiary, fontStyle: "italic", fontSize: 13 },
  formCard: { backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  input: { backgroundColor: Colors.bg, color: Colors.textPrimary, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.sm, borderColor: Colors.border, borderWidth: 1, fontSize: 14 },
});
