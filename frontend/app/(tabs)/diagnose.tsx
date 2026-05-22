import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { AudioModule, RecordingPresets, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { api, Vehicle } from "../../src/api";
import { Colors, Radius } from "../../src/theme";

type Msg = { role: "user" | "assistant"; text: string; image?: string };

export default function Diagnose() {
  const [sessionId] = useState(() => `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: "Hi, I'm MechAnIc — your AI Mechanic. Describe what's happening with your car. You can also send a photo of a dashboard light or part, or tap the mic to record symptoms." },
  ]);
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null); // base64
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  useEffect(() => {
    (async () => {
      try {
        const vs = await api.vehicles();
        if (vs[0]) setVehicle(vs[0]);
      } catch {}
    })();
  }, []);

  const scrollToEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo access needed", "Allow photo access to share an image with the mechanic.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      if (a.base64) {
        setPendingImage(a.base64);
        setPendingImagePreview(a.uri);
      }
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera to snap a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) {
      setPendingImage(result.assets[0].base64);
      setPendingImagePreview(result.assets[0].uri);
    }
  };

  const startStopRec = async () => {
    try {
      if (recState.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) return;
        setSending(true);
        let b64 = "";
        if (Platform.OS === "web") {
          const blob = await (await fetch(uri)).blob();
          b64 = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onloadend = () => resolve((r.result as string).split(",")[1] || "");
            r.readAsDataURL(blob);
          });
        } else {
          b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        }
        try {
          const { text: transcript } = await api.transcribe(b64, "audio/m4a");
          setText((prev) => (prev ? prev + " " : "") + transcript);
        } catch (e: any) {
          Alert.alert("Transcription failed", e?.message || "Try typing instead");
        } finally {
          setSending(false);
        }
      } else {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Microphone needed", "Allow microphone access to record symptoms.");
          return;
        }
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
    } catch (e: any) {
      Alert.alert("Recording error", e?.message || "Failed");
    }
  };

  const send = useCallback(async () => {
    if (!text.trim() && !pendingImage) return;
    const userMsg: Msg = { role: "user", text: text.trim() || "(photo)", image: pendingImagePreview || undefined };
    setMessages((m) => [...m, userMsg]);
    const t = text.trim() || "Please analyze this image.";
    const img = pendingImage;
    setText(""); setPendingImage(null); setPendingImagePreview(null);
    setSending(true);
    scrollToEnd();
    try {
      const res = await api.chat({
        session_id: sessionId,
        message: t,
        image_base64: img || undefined,
        vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year } : undefined,
      });
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      scrollToEnd();
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `⚠️ ${e?.message || "AI error. Try again."}` }]);
    } finally {
      setSending(false);
    }
  }, [text, pendingImage, pendingImagePreview, sessionId, vehicle]);

  const saveSession = async () => {
    const summary = messages.filter((m) => m.role === "assistant").slice(-1)[0]?.text || "Diagnosis session";
    try {
      await api.saveDiagnosis({
        session_id: sessionId,
        title: messages.find((m) => m.role === "user")?.text?.slice(0, 60) || "Untitled diagnosis",
        summary,
        vehicle: vehicle ? { make: vehicle.make, model: vehicle.model, year: vehicle.year } : undefined,
      });
      Alert.alert("Saved", "Diagnosis saved to history.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Try again");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>◆ AI MECHANIC</Text>
          <Text style={styles.headerSub}>{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "No vehicle linked"}</Text>
        </View>
        <TouchableOpacity testID="save-diagnosis" onPress={saveSession} style={styles.saveBtn}>
          <Ionicons name="bookmark-outline" size={16} color={Colors.neon} />
          <Text style={styles.saveBtnTxt}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => `m_${i}`}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 20 }}
          renderItem={({ item }) => <Bubble msg={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {sending && (
          <View style={styles.typing}>
            <ActivityIndicator color={Colors.neon} size="small" />
            <Text style={styles.typingTxt}>Analyzing…</Text>
          </View>
        )}

        {pendingImagePreview && (
          <View style={styles.attachPreview}>
            <Image source={{ uri: pendingImagePreview }} style={{ width: 56, height: 56, borderRadius: 8 }} />
            <Text style={styles.attachTxt}>Image attached</Text>
            <TouchableOpacity onPress={() => { setPendingImage(null); setPendingImagePreview(null); }}>
              <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Action toolbar — clear icon+label buttons */}
        <View style={styles.actionBar}>
          <ActionButton
            testID="btn-camera"
            icon="camera-outline"
            label="Camera"
            onPress={takePhoto}
          />
          <ActionButton
            testID="btn-attach"
            icon="image-outline"
            label="Photo"
            onPress={pickImage}
          />
          <ActionButton
            testID="btn-mic"
            icon={recState.isRecording ? "stop-circle" : "mic-outline"}
            label={recState.isRecording ? "Stop" : "Voice"}
            onPress={startStopRec}
            active={recState.isRecording}
          />
        </View>

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder={recState.isRecording ? "Recording… tap Stop above" : "Describe the problem…"}
            placeholderTextColor={Colors.textTertiary}
            style={styles.input}
            multiline
          />
          <TouchableOpacity testID="btn-send" onPress={send} disabled={sending} style={[styles.sendBtn, sending && { opacity: 0.5 }]}>
            <Ionicons name="send" size={16} color="#000" />
            <Text style={styles.sendBtnTxt}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isUser && <Text style={styles.botTag}>MechAnIc</Text>}
      {msg.image && <Image source={{ uri: msg.image }} style={styles.bubbleImg} />}
      <Text style={[styles.bubbleTxt, isUser ? styles.bubbleTxtUser : styles.bubbleTxtBot]}>{msg.text}</Text>
    </View>
  );
}

function ActionButton({ icon, label, onPress, active, testID }: { icon: any; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  return (
    <TouchableOpacity testID={testID} activeOpacity={0.8} onPress={onPress} style={[styles.actionBtn, active && styles.actionBtnActive]}>
      <Ionicons name={icon} size={20} color={active ? Colors.red : Colors.neon} />
      <Text style={[styles.actionLabel, active && { color: Colors.red }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomColor: Colors.border, borderBottomWidth: 1 },
  headerTitle: { color: Colors.neon, fontSize: 16, fontWeight: "800", letterSpacing: 3 },
  headerSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  saveBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderColor: Colors.neonDim, borderWidth: 1 },
  bubbleWrap: { maxWidth: "85%", padding: 12, borderRadius: 14, borderWidth: 1 },
  bubbleLeft: { alignSelf: "flex-start", backgroundColor: Colors.surfaceSolid, borderColor: Colors.neonDim },
  bubbleRight: { alignSelf: "flex-end", backgroundColor: Colors.neonDim, borderColor: Colors.neon },
  botTag: { color: Colors.neon, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  bubbleTxt: { fontSize: 14, lineHeight: 20 },
  bubbleTxtBot: { color: Colors.textPrimary },
  bubbleTxtUser: { color: "#FFFFFF" },
  bubbleImg: { width: 200, height: 140, borderRadius: 8, marginBottom: 8 },
  typing: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  typingTxt: { color: Colors.textSecondary, fontSize: 12 },
  attachPreview: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 12, marginBottom: 6, padding: 8, backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1, borderRadius: 10 },
  attachTxt: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  inputBar: { flexDirection: "row", padding: 10, gap: 8, alignItems: "flex-end", borderTopColor: Colors.border, borderTopWidth: 1, backgroundColor: Colors.bgSecondary },
  actionBar: { flexDirection: "row", paddingHorizontal: 10, paddingTop: 8, gap: 8, backgroundColor: Colors.bgSecondary, borderTopColor: Colors.border, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: Colors.surfaceSolid, borderColor: Colors.neonDim, borderWidth: 1, borderRadius: Radius.md },
  actionBtnActive: { borderColor: Colors.red, backgroundColor: "rgba(255,59,48,0.08)" },
  actionLabel: { color: Colors.neon, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surfaceSolid, borderColor: Colors.border, borderWidth: 1 },
  iconBtnActive: { borderColor: Colors.red },
  input: { flex: 1, color: Colors.textPrimary, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.surfaceSolid, borderRadius: Radius.md, borderColor: Colors.border, borderWidth: 1, fontSize: 14, maxHeight: 100 },
  sendBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 44, paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Colors.neon },
  sendBtnTxt: { color: "#000", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
});
