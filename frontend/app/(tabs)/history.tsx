import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "../../src/components/Ionicons";
import { api } from "../../src/api";
import { Colors, Radius } from "../../src/theme";

type Tab = "diag" | "shop";

export default function History() {
  const [tab, setTab] = useState<Tab>("diag");
  const [diag, setDiag] = useState<any[]>([]);
  const [shop, setShop] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.listDiagnoses(), api.listShopping()]);
      setDiag(d); setShop(s);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>◆ HISTORY</Text>
        <Text style={styles.sub}>Past diagnoses & shopping lists</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity testID="tab-diagnoses" onPress={() => setTab("diag")} style={[styles.tab, tab === "diag" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "diag" && styles.tabTxtActive]}>DIAGNOSES ({diag.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-shopping" onPress={() => setTab("shop")} style={[styles.tab, tab === "shop" && styles.tabActive]}>
          <Text style={[styles.tabTxt, tab === "shop" && styles.tabTxtActive]}>SHOPPING ({shop.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === "diag" ? (
        <FlatList
          data={diag}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl tintColor={Colors.neon} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<Empty icon="pulse-outline" text="No saved diagnoses yet." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="pulse" size={16} color={Colors.neon} />
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              </View>
              <Text style={styles.cardBody} numberOfLines={4}>{item.summary}</Text>
              <View style={styles.cardFoot}>
                {item.vehicle && <Text style={styles.cardMeta}>{item.vehicle.year} {item.vehicle.make} {item.vehicle.model}</Text>}
                <Text style={styles.cardDate}>{new Date(item.ts).toLocaleDateString()}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={shop}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl tintColor={Colors.neon} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<Empty icon="cart-outline" text="No saved shopping lists yet." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="cart" size={16} color={Colors.neon} />
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              </View>
              {(item.items || []).slice(0, 3).map((p: any, i: number) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(p.url)} style={styles.shopRow}>
                  <Text style={styles.shopTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.shopPrice}>${p.price.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
              {item.items && item.items.length > 3 && <Text style={styles.moreTxt}>+ {item.items.length - 3} more</Text>}
              <Text style={styles.cardDate}>{new Date(item.ts).toLocaleDateString()}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={48} color={Colors.textTertiary} />
      <Text style={styles.emptyTxt}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { color: Colors.neon, fontSize: 18, fontWeight: "800", letterSpacing: 3 },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: 4, borderColor: Colors.border, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: Radius.sm },
  tabActive: { backgroundColor: Colors.neonDim, borderColor: Colors.neon, borderWidth: 1 },
  tabTxt: { color: Colors.textSecondary, fontSize: 11, letterSpacing: 1.2, fontWeight: "700" },
  tabTxtActive: { color: Colors.neon },
  card: { padding: 14, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: Radius.md, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700", flex: 1 },
  cardBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  cardMeta: { color: Colors.textTertiary, fontSize: 11, fontWeight: "600" },
  cardDate: { color: Colors.textTertiary, fontSize: 11 },
  shopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomColor: Colors.border, borderBottomWidth: 1, gap: 12 },
  shopTitle: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  shopPrice: { color: Colors.neon, fontSize: 13, fontWeight: "700" },
  moreTxt: { color: Colors.textTertiary, fontSize: 12 },
  empty: { padding: 40, alignItems: "center", gap: 12 },
  emptyTxt: { color: Colors.textSecondary, fontSize: 13 },
});
