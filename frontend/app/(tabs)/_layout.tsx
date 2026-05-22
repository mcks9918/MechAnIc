import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "../../src/components/Ionicons";
import { Colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.neon,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: "HOME",
        tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="diagnose" options={{
        title: "DIAGNOSE",
        tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="parts" options={{
        title: "PARTS",
        tabBarIcon: ({ color, size }) => <Ionicons name="cog-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="history" options={{
        title: "HISTORY",
        tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: "PROFILE",
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
