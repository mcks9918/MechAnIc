import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity,
  Image, Linking, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api, PartResult, Vehicle } from "../../src/api";
import { Colors, Radius } from "../../src/theme";

export default function PartsScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [useVehicle, setUseVehicle] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const vs = await api.vehicles();
        if (vs[0]) setVehicle(vs[0]);
      } catch {}
    })();
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const v = useVehicle && vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year } : undefined;
      const r = await api.searchParts(query.trim(), v);
      setResults(r);
      if (r.length === 0) Alert.alert("No results", "Try a more general search term.");
    } catch (e: any) {
      Alert.alert("Search failed", e?.message || "Try again");
    } finally {
      setLoading(false);
    }
  };

  const saveList = async () => {
    if (results.length === 0) return;
    try {
      await api.saveShopping({ title: query.trim() || "Shopping list", items: results.slice(0, 10) });
      Alert.alert("Saved", "Shopping list saved to history.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Try again");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>◆ PARTS RADAR</Text>
        <Text style={styles.sub}>Find the cheapest parts online</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            testID="parts-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="brake pads, oil filter, alternator…"
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
            onSubmitEditing={search}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity testID="parts-search-btn" onPress={search} style={styles.searchBtn}>
          <Ionicons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {vehicle && (
        <TouchableOpacity testID="vehicle-filter" onPress={() => setUseVehicle((v) => !v)} style={[styles.chip, useVehicle && styles.chipActive]}>
          <Ionicons name={useVehicle ? "checkmark-circle" : "ellipse-outline"} size={16} color={useVehicle ? Colors.neon : Colors.textTertiary} />
          <Text style={[styles.chipTxt, useVehicle && { color: Colors.neon }]}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </TouchableOpacity>
      )}

      {loading && <ActivityIndicator color={Colors.neon} style={{ marginVertical: 14 }} />}

      <FlatList
        data={results}
        keyExtractor={(item, i) => `${i}_${item.url}`}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="cog-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTxt}>Search a part to see the cheapest deals on eBay, sorted by price.</Text>
          </View>
        ) : null}
        ListHeaderComponent={results.length > 0 ? (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultCount}>{results.length} RESULTS · CHEAPEST FIRST</Text>
            <TouchableOpacity testID="save-shopping" onPress={saveList} style={styles.saveLink}>
              <Ionicons name="bookmark-outline" size={14} color={Colors.neon} />
              <Text style={styles.saveLinkTxt}>SAVE LIST</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => Linking.openURL(item.url)} style={styles.card}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.img} />
            ) : (
              <View style={[styles.img, { alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="cog" size={28} color={Colors.textTertiary} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.source}>{item.source}</Text>
                {index === 0 && <Text style={styles.bestBadge}>BEST PRICE</Text>}
              </View>
            </View>
            <View style={styles.priceWrap}>
              <Text style={styles.price}>${item.price.toFixed(2)}</Text>
              <Ionicons name="open-outline" size={14} color={Colors.neon} />
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: Colors.neon, fontSize: 18, fontWeight: "800", letterSpacing: 3 },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  searchRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, alignItems: "center" },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12 },
  input: { flex: 1, color: Colors.textPrimary, paddingVertical: 12, fontSize: 14 },
  searchBtn: { width: 46, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neon, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginHorizontal: 16, marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: 20 },
  chipActive: { borderColor: Colors.neonDim, backgroundColor: "rgba(0,240,255,0.06)" },
  chipTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  resultCount: { color: Colors.textTertiary, fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  saveLink: { flexDirection: "row", alignItems: "center", gap: 4 },
  saveLinkTxt: { color: Colors.neon, fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  card: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, alignItems: "center" },
  img: { width: 64, height: 64, borderRadius: 8, backgroundColor: Colors.bg },
  cardTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  source: { color: Colors.textTertiary, fontSize: 11, letterSpacing: 1 },
  bestBadge: { color: "#000", backgroundColor: Colors.neon, fontSize: 10, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, letterSpacing: 1 },
  priceWrap: { alignItems: "flex-end", gap: 6 },
  price: { color: Colors.neon, fontSize: 16, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyTxt: { color: Colors.textSecondary, textAlign: "center", fontSize: 13, lineHeight: 18 },
});
