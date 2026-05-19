# GearMind — PRD

## Vision
Mobile app that finds cheapest car parts online and offers an AI Mechanic that diagnoses problems via multi-turn Q&A, photos of dashboard lights/parts, and voice recordings.

## Stack
- Expo React Native (file-based routing via expo-router)
- FastAPI backend + MongoDB (motor)
- Claude Sonnet 4.5 (chat + vision) via emergentintegrations
- OpenAI Whisper-1 (voice → text) via emergentintegrations
- eBay scraper with AI-curated parts fallback (eBay blocks our container IP, so Claude generates a realistic catalog of brand-name parts with click-through to live eBay search URLs)

## Features (v1)
1. JWT email/password auth (bcrypt hashing; SecureStore on client)
2. Home dashboard with vehicle card + quick actions + status indicator
3. AI Mechanic chat (multi-turn, image attach via camera/library, voice recording → Whisper → transcript → Claude)
4. Parts Radar: cheapest-first list with brand-name results, BEST PRICE badge, deep link to eBay, save as shopping list
5. Vehicle profile CRUD (make/model/year/nickname)
6. History: saved diagnoses + shopping lists with tab toggle

## Theme
Silver + neon baby blue (`#00F0FF`) futuristic automotive HUD. Dark `#05070A` base, glassmorphic cards, scanline overlay on splash/auth, neon glow accents.

## Deferred
- Emergent Google OAuth (requires custom dev client / EAS build; v2)
- Push notifications for maintenance reminders
- Multi-store scraping (RockAuto, AutoZone) once IP unblocked or via official APIs

## Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET/POST/DELETE /api/vehicles[/:id]
- POST /api/ai/chat, /api/ai/transcribe
- POST /api/parts/search
- GET/POST /api/history/diagnoses, /api/history/shopping

## Smart Enhancement
Save Shopping List feature converts AI-curated catalog into actionable shareable lists — drives repeat usage and creates a viral loop (share list with mechanic friend).
