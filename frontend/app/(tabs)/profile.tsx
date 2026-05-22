import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try { setVehicles(await api.vehicles()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setMake(""); setModel(""); setYear(""); setNickname(""); setEditingId(null);
  };

  const startEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setMake(v.make);
    setModel(v.model);
    setYear(String(v.year));
    setNickname(v.nickname || "");
    setTimeout(() => formRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const submit = async () => {
    const y = parseInt(year, 10);
    if (!make.trim() || !model.trim() || !y || y < 1900) {
      Alert.alert("Required", "Make, model and a valid year are required.");
      return;
    }
    setBusy(true);
    try {
      const payload = { make: make.trim(), model: model.trim(), year: y, nickname: nickname.trim() || undefined };
      if (editingId) {
        await api.updateVehicle(editingId, payload);
      } else {
        await api.addVehicle(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Try again");
    } finally { setBusy(false); }
  };

  const remove = (id: string) => {
    Alert.alert("Remove vehicle?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.deleteVehicle(id);
          if (editingId === id) resetForm();
          await load();
        } catch (e: any) { Alert.alert("Failed", e?.message); }
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
        <ScrollView ref={formRef} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.title}>◆ PROFILE</Text>
            <Text style={styles.sub}>{user?.email}</Text>
          </View>

          <Text style={styles.section}>YOUR GARAGE</Text>
          {vehicles.length === 0 && <Text style={styles.empty}>No vehicles yet. Add your first below.</Text>}
          {vehicles.map((v) => {
            const isEditing = editingId === v.id;
            return (
              <View key={v.id} style={[styles.vCard, isEditing && styles.vCardEditing]}>
                <Ionicons name="car-sport-outline" size={24} color={isEditing ? Colors.neon : Colors.silver} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.vTitle}>{v.year} {v.make} {v.model}</Text>
                  {v.nickname ? <Text style={styles.vSub}>{v.nickname}</Text> : null}
                  {isEditing && <Text style={styles.editingTag}>EDITING BELOW</Text>}
                </View>
                <TouchableOpacity testID={`edit-vehicle-${v.id}`} onPress={() => startEdit(v)} style={styles.vAction}>
                  <Ionicons name="bookmark-outline" size={16} color={Colors.neon} />
                  <Text style={styles.vActionTxt}>EDIT</Text>
                </TouchableOpacity>
                <TouchableOpacity testID={`delete-vehicle-${v.id}`} onPress={() => remove(v.id)} style={styles.vIconBtn}>
                  <Ionicons name="trash-outline" size={18} color={Colors.red} />
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={styles.sectionRow}>
            <Text style={styles.section}>{editingId ? "EDIT VEHICLE" : "ADD VEHICLE"}</Text>
            {editingId && (
              <TouchableOpacity testID="cancel-edit-btn" onPress={resetForm}>
                <Text style={styles.cancelTxt}>CANCEL</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.formCard}>
            <View style={styles.row}>
              <TextInput testID="input-make" value={make} onChangeText={setMake} placeholder="Make (Toyota)" placeholderTextColor={Colors.textTertiary} style={[styles.input, { flex: 1 }]} />
              <TextInput testID="input-year" value={year} onChangeText={setYear} placeholder="Year" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" style={[styles.input, { width: 90 }]} />
            </View>
            <TextInput testID="input-model" value={model} onChangeText={setModel} placeholder="Model (Camry)" placeholderTextColor={Colors.textTertiary} style={styles.input} />
            <TextInput testID="input-nickname" value={nickname} onChangeText={setNickname} placeholder="Nickname (optional)" placeholderTextColor={Colors.textTertiary} style={styles.input} />
            <NeonButton testID="submit-vehicle-btn" title={editingId ? "Save Changes" : "Add to Garage"} onPress={submit} loading={busy} />
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
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cancelTxt: { color: Colors.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  vCard: { flexDirection: "row", gap: 10, alignItems: "center", padding: 14, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md },
  vCardEditing: { borderColor: Colors.neon, backgroundColor: "rgba(0,240,255,0.05)" },
  vTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },
  vSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  editingTag: { color: Colors.neon, fontSize: 10, letterSpacing: 1.5, fontWeight: "700", marginTop: 4 },
  vAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderColor: Colors.neonDim, borderWidth: 1, borderRadius: 16, backgroundColor: "rgba(0,240,255,0.06)" },
  vActionTxt: { color: Colors.neon, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  vIconBtn: { padding: 6 },
  empty: { color: Colors.textTertiary, fontStyle: "italic", fontSize: 13 },
  formCard: { backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, padding: 14, gap: 10 },
  row: { flexDirection: "row", gap: 8 },
  input: { backgroundColor: Colors.bg, color: Colors.textPrimary, paddingHorizontal: 12, paddingVertical: 12, borderRadius: Radius.sm, borderColor: Colors.border, borderWidth: 1, fontSize: 14 },
});
