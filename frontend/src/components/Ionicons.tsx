// Drop-in replacement for @expo/vector-icons' Ionicons using lucide-react-native (SVG).
// Eliminates ExpoFontLoader.loadAsync errors on web/iOS/Android.
import React from "react";
import {
  Camera,
  Image as LImage,
  Mic,
  StopCircle,
  XCircle,
  Send,
  Bookmark,
  Search,
  ArrowRight,
  CheckCircle2,
  Circle,
  Cog,
  ExternalLink,
  Activity,
  ShoppingCart,
  Car,
  Trash2,
  Gauge,
  Clock,
  User,
  Lightbulb,
} from "lucide-react-native";

const MAP: Record<string, React.ComponentType<any>> = {
  // diagnose
  "camera-outline": Camera,
  camera: Camera,
  "image-outline": LImage,
  image: LImage,
  "mic-outline": Mic,
  mic: Mic,
  "stop-circle": StopCircle,
  "close-circle": XCircle,
  send: Send,
  "bookmark-outline": Bookmark,
  bookmark: Bookmark,
  // parts
  search: Search,
  "arrow-forward": ArrowRight,
  "checkmark-circle": CheckCircle2,
  "ellipse-outline": Circle,
  "cog-outline": Cog,
  cog: Cog,
  "open-outline": ExternalLink,
  // history
  pulse: Activity,
  "pulse-outline": Activity,
  cart: ShoppingCart,
  "cart-outline": ShoppingCart,
  // profile / home
  "car-sport-outline": Car,
  "car-sport": Car,
  "trash-outline": Trash2,
  "speedometer-outline": Gauge,
  speedometer: Gauge,
  "time-outline": Clock,
  time: Clock,
  "person-outline": User,
  person: User,
  "bulb-outline": Lightbulb,
};

type IoniconsProps = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
};

export function Ionicons({ name, size = 22, color = "#000", style }: IoniconsProps) {
  const Cmp = MAP[name] || Circle;
  return <Cmp size={size} color={color} style={style} strokeWidth={1.8} />;
}

// Stub `.font` so any leftover `useFonts(Ionicons.font)` calls are a no-op.
(Ionicons as any).font = {};
