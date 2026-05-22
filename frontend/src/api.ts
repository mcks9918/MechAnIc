import { storage } from "./utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export type User = { id: string; email: string; full_name?: string | null };
export type Vehicle = { id: string; user_id: string; make: string; model: string; year: number; nickname?: string | null; created_at: string };
export type PartResult = { title: string; price: number; currency: string; url: string; image_url?: string | null; source: string };

const TOKEN_KEY = "gm_token";

export async function getToken(): Promise<string | null> {
  return (await storage.secureGet<string>(TOKEN_KEY, "")) || null;
}
export async function setToken(t: string) { await storage.secureSet(TOKEN_KEY, t); }
export async function clearToken() { await storage.secureRemove(TOKEN_KEY); }

async function req<T = any>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as any) };
  if (opts.auth !== false) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const r = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) {
    const msg = typeof data === "object" ? (data as any)?.detail || JSON.stringify(data) : data;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data as T;
}

export const api = {
  register: (email: string, password: string, full_name?: string) =>
    req<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name }), auth: false }),
  login: (email: string, password: string) =>
    req<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }), auth: false }),
  me: () => req<User>("/auth/me"),
  vehicles: () => req<Vehicle[]>("/vehicles"),
  addVehicle: (v: { make: string; model: string; year: number; nickname?: string }) =>
    req<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(v) }),
  updateVehicle: (id: string, v: { make: string; model: string; year: number; nickname?: string }) =>
    req<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(v) }),
  deleteVehicle: (id: string) => req(`/vehicles/${id}`, { method: "DELETE" }),
  chat: (payload: { session_id: string; message: string; image_base64?: string; vehicle?: any }) =>
    req<{ session_id: string; reply: string }>("/ai/chat", { method: "POST", body: JSON.stringify(payload) }),
  transcribe: (audio_base64: string, mime: string) =>
    req<{ text: string }>("/ai/transcribe", { method: "POST", body: JSON.stringify({ audio_base64, mime }) }),
  soundDiagnose: (payload: { session_id: string; audio_base64: string; mime: string; note?: string; vehicle?: any }) =>
    req<{ session_id: string; reply: string }>("/ai/sound-diagnose", { method: "POST", body: JSON.stringify(payload) }),
  searchParts: (part_name: string, vehicle?: { make?: string; model?: string; year?: number }) =>
    req<PartResult[]>("/parts/search", { method: "POST", body: JSON.stringify({ part_name, ...(vehicle || {}) }) }),
  listDiagnoses: () => req<any[]>("/history/diagnoses"),
  saveDiagnosis: (d: { session_id: string; title: string; summary: string; vehicle?: any }) =>
    req("/history/diagnoses", { method: "POST", body: JSON.stringify(d) }),
  listShopping: () => req<any[]>("/history/shopping"),
  saveShopping: (s: { title: string; items: PartResult[] }) =>
    req("/history/shopping", { method: "POST", body: JSON.stringify(s) }),
};
