import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, Vehicle } from "../../src/api";
import { useAuth } from "../../src/auth";
import { Colors, Radius } from "../../src/theme";
import { Scanlines } from "../../src/components/Scanlines";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setVehicles(await api.vehicles()); } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const primary = vehicles[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Scanlines />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor={Colors.neon} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>WELCOME BACK</Text>
            <Text style={styles.name}>{user?.full_name || user?.email?.split("@")[0] || "Driver"}</Text>
          </View>
          <View style={styles.statusDot} />
        </View>

        {/* Vehicle Card */}
        <TouchableOpacity testID="vehicle-card" activeOpacity={0.85} onPress={() => router.push("/(tabs)/profile")} style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <Text style={styles.vehicleLabel}>ACTIVE VEHICLE</Text>
            <Ionicons name="car-sport" size={24} color={Colors.neon} />
          </View>
          {primary ? (
            <>
              <Text style={styles.vehicleTitle}>{primary.year} {primary.make}</Text>
              <Text style={styles.vehicleSub}>{primary.model}{primary.nickname ? ` · ${primary.nickname}` : ""}</Text>
              <View style={styles.vehicleStatRow}>
                <View style={styles.vehicleStat}>
                  <Text style={styles.statLabel}>FLEET</Text>
                  <Text style={styles.statValue}>{vehicles.length}</Text>
                </View>
                <View style={styles.vehicleStat}>
                  <Text style={styles.statLabel}>STATUS</Text>
                  <Text style={[styles.statValue, { color: Colors.neon }]}>READY</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.vehicleTitle}>No vehicle linked</Text>
              <Text style={styles.vehicleSub}>Tap to add your make, model & year</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.grid}>
          <ActionTile testID="action-diagnose" icon="pulse" label="Diagnose" desc="AI Mechanic Q&A" onPress={() => router.push("/(tabs)/diagnose")} />
          <ActionTile testID="action-parts" icon="cog" label="Find Parts" desc="Cheapest online" onPress={() => router.push("/(tabs)/parts")} />
          <ActionTile testID="action-history" icon="time" label="History" desc="Past diagnoses" onPress={() => router.push("/(tabs)/history")} />
          <ActionTile testID="action-profile" icon="person" label="Profile" desc="Your garage" onPress={() => router.push("/(tabs)/profile")} />
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={Colors.neon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>Pro tip</Text>
            <Text style={styles.tipText}>Snap a photo of your dashboard warning light during diagnosis — the AI Mechanic can read it instantly.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({ icon, label, desc, onPress, testID }: { icon: any; label: string; desc: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.85} onPress={onPress} style={styles.tile}>
      <Ionicons name={`${icon}-outline` as any} size={28} color={Colors.neon} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { color: Colors.textTertiary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  name: { color: Colors.textPrimary, fontSize: 24, fontWeight: "700", marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.neon, shadowColor: Colors.neon, shadowOpacity: 1, shadowRadius: 8 },
  vehicleCard: {
    backgroundColor: Colors.surfaceSolid,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.neonDim,
    padding: 20,
    gap: 6,
    shadowColor: Colors.neon, shadowOpacity: 0.2, shadowRadius: 16,
  },
  vehicleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  vehicleLabel: { color: Colors.textTertiary, fontSize: 10, letterSpacing: 2.5, fontWeight: "700" },
  vehicleTitle: { color: Colors.textPrimary, fontSize: 26, fontWeight: "800" },
  vehicleSub: { color: Colors.textSecondary, fontSize: 14 },
  vehicleStatRow: { flexDirection: "row", gap: 24, marginTop: 14, paddingTop: 14, borderTopColor: Colors.border, borderTopWidth: 1 },
  vehicleStat: { flex: 1 },
  statLabel: { color: Colors.textTertiary, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  statValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 4 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 11, letterSpacing: 2.5, fontWeight: "700", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47%",
    backgroundColor: Colors.surfaceSolid,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
    minHeight: 120,
  },
  tileLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 8 },
  tileDesc: { color: Colors.textTertiary, fontSize: 12 },
  tipCard: {
    flexDirection: "row", gap: 12, padding: 16, backgroundColor: "rgba(0,240,255,0.06)",
    borderColor: Colors.neonDim, borderWidth: 1, borderRadius: Radius.md, alignItems: "flex-start",
  },
  tipTitle: { color: Colors.neon, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  tipText: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
});
