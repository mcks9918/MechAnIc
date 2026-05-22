from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import base64
import uuid
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt as pyjwt
import httpx
from bs4 import BeautifulSoup

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MechAnIc API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("gearmind")


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: Optional[str] = None


class AuthOut(BaseModel):
    token: str
    user: UserOut


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    make: str
    model: str
    year: int
    nickname: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class VehicleIn(BaseModel):
    make: str
    model: str
    year: int
    nickname: Optional[str] = None


class ChatIn(BaseModel):
    session_id: str
    message: str
    image_base64: Optional[str] = None  # data URL or raw base64
    vehicle: Optional[VehicleIn] = None


class ChatOut(BaseModel):
    session_id: str
    reply: str


class TranscribeIn(BaseModel):
    audio_base64: str
    mime: str = "audio/m4a"


class PartsSearchIn(BaseModel):
    part_name: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None


class PartResult(BaseModel):
    title: str
    price: float
    currency: str = "USD"
    url: str
    image_url: Optional[str] = None
    source: str


class DiagnosisSave(BaseModel):
    session_id: str
    title: str
    summary: str
    vehicle: Optional[VehicleIn] = None


class ShoppingListSave(BaseModel):
    title: str
    items: List[PartResult]


# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        data = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": data["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ---------- Auth routes ----------
@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "full_name": body.full_name,
        "password": hash_pw(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    return AuthOut(
        token=make_token(user_id),
        user=UserOut(id=user_id, email=body.email.lower(), full_name=body.full_name),
    )


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    return AuthOut(
        token=make_token(user["id"]),
        user=UserOut(id=user["id"], email=user["email"], full_name=user.get("full_name")),
    )


@api.get("/auth/me", response_model=UserOut)
async def me(user=Depends(current_user)):
    return UserOut(id=user["id"], email=user["email"], full_name=user.get("full_name"))


# ---------- Vehicles ----------
@api.get("/vehicles", response_model=List[Vehicle])
async def list_vehicles(user=Depends(current_user)):
    items = await db.vehicles.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return [Vehicle(**v) for v in items]


@api.post("/vehicles", response_model=Vehicle)
async def add_vehicle(body: VehicleIn, user=Depends(current_user)):
    v = Vehicle(user_id=user["id"], **body.dict())
    doc = v.dict()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.vehicles.insert_one(doc)
    return v


@api.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user=Depends(current_user)):
    res = await db.vehicles.delete_one({"id": vehicle_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    return {"ok": True}


# ---------- AI Mechanic ----------
MECHANIC_SYSTEM = (
    "You are MechAnIc, an expert AI Mechanic. Diagnose car problems by asking ONE focused, "
    "clarifying question at a time (about symptoms, sounds, smells, when it happens, recent "
    "service, mileage). After 3-5 turns, provide a likely diagnosis with: 1) probable cause, "
    "2) urgency level (low/medium/high), 3) DIY vs shop recommendation, 4) suggested parts to "
    "check or replace (give exact part names so the user can search prices). If the user uploads "
    "a photo, analyze it (dashboard warning light, part condition, leak, etc). Be concise, "
    "friendly, and confident. Avoid medical-style disclaimers. Use plain text, no markdown headers."
)


@api.post("/ai/chat", response_model=ChatOut)
async def ai_chat(body: ChatIn, user=Depends(current_user)):
    try:
        sys_msg = MECHANIC_SYSTEM
        if body.vehicle:
            sys_msg += f"\n\nUser's vehicle: {body.vehicle.year} {body.vehicle.make} {body.vehicle.model}."

        # Load prior turns for this session so the model has full context
        prior = await db.chat_messages.find(
            {"user_id": user["id"], "session_id": body.session_id},
            {"_id": 0, "message": 1, "reply": 1},
        ).sort("ts", 1).to_list(200)

        initial_messages = [{"role": "system", "content": sys_msg}]
        for t in prior:
            if t.get("message"):
                initial_messages.append({"role": "user", "content": t["message"]})
            if t.get("reply"):
                initial_messages.append({"role": "assistant", "content": t["reply"]})

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"{user['id']}::{body.session_id}",
            system_message=sys_msg,
            initial_messages=initial_messages,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        file_contents = []
        if body.image_base64:
            raw = body.image_base64
            if "," in raw and raw.startswith("data:"):
                raw = raw.split(",", 1)[1]
            file_contents.append(ImageContent(image_base64=raw))

        msg = UserMessage(text=body.message or "Please analyze.", file_contents=file_contents or None)
        reply = await chat.send_message(msg)

        # Persist chat turn
        await db.chat_messages.insert_one({
            "user_id": user["id"],
            "session_id": body.session_id,
            "message": body.message,
            "reply": reply,
            "has_image": bool(body.image_base64),
            "ts": datetime.now(timezone.utc).isoformat(),
        })

        return ChatOut(session_id=body.session_id, reply=reply)
    except HTTPException:
        raise
    except Exception as e:
        log.exception("ai_chat failed")
        raise HTTPException(500, f"AI error: {e}")


@api.post("/ai/transcribe")
async def transcribe(body: TranscribeIn, user=Depends(current_user)):
    try:
        raw = body.audio_base64
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        audio_bytes = base64.b64decode(raw)

        ext = ".m4a"
        if "wav" in body.mime:
            ext = ".wav"
        elif "mp3" in body.mime or "mpeg" in body.mime:
            ext = ".mp3"
        elif "webm" in body.mime:
            ext = ".webm"
        elif "mp4" in body.mime:
            ext = ".mp4"

        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
        result = await stt.transcribe(file=tmp_path, model="whisper-1", response_format="text")
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

        if isinstance(result, str):
            text = result
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = getattr(result, "text", str(result))
        return {"text": text}
    except Exception as e:
        log.exception("transcribe failed")
        raise HTTPException(500, f"Transcribe error: {e}")


# ---------- Parts Search ----------
async def scrape_ebay(query: str, limit: int = 12) -> List[PartResult]:
    url = f"https://www.ebay.com/sch/i.html?_nkw={query.replace(' ', '+')}&_sop=15"  # sort: price+shipping low
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept-Language": "en-US,en;q=0.9",
    }
    results: List[PartResult] = []
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as c:
            r = await c.get(url, headers=headers)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "lxml")
            for li in soup.select("li.s-item")[:limit + 4]:
                title_el = li.select_one(".s-item__title")
                price_el = li.select_one(".s-item__price")
                link_el = li.select_one("a.s-item__link")
                img_el = li.select_one(".s-item__image img")
                if not (title_el and price_el and link_el):
                    continue
                title = title_el.get_text(strip=True)
                if title.lower().startswith("shop on ebay"):
                    continue
                price_text = price_el.get_text(strip=True)
                m = re.search(r"[\d,]+\.\d{2}", price_text)
                if not m:
                    continue
                try:
                    price = float(m.group(0).replace(",", ""))
                except ValueError:
                    continue
                img_url = None
                if img_el:
                    img_url = img_el.get("src") or img_el.get("data-src")
                results.append(PartResult(
                    title=title[:140],
                    price=price,
                    url=link_el.get("href", ""),
                    image_url=img_url,
                    source="eBay",
                ))
                if len(results) >= limit:
                    break
    except Exception as e:
        log.warning(f"eBay scrape failed: {e}")
    return results


@api.post("/parts/search", response_model=List[PartResult])
async def parts_search(body: PartsSearchIn, user=Depends(current_user)):
    parts_q = body.part_name.strip()
    vehicle_q = " ".join([str(x) for x in [body.year, body.make, body.model] if x])
    query = f"{parts_q} {vehicle_q}".strip()
    ebay_search_url = f"https://www.ebay.com/sch/i.html?_nkw={query.replace(' ', '+')}&_sop=15"

    # Try real eBay scrape first
    results = await scrape_ebay(query)

    # Fallback: AI-curated catalog (Claude knows realistic OEM/aftermarket parts + price ranges)
    if not results:
        try:
            prompt = (
                f"List 8 real auto parts that match a search for '{parts_q}'"
                + (f" for a {vehicle_q}" if vehicle_q else "")
                + ". For each item return ONLY a JSON array (no prose, no markdown) of objects with keys: "
                + "title (string, realistic product name including brand like Bosch, ACDelco, Denso, Wagner, Brembo, Duralast, Motorcraft, Beck Arnley), "
                + "price (number, realistic USD market price), "
                + "brand (string). Sort by price ascending. Return ONLY the JSON array."
            )
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"parts_{uuid.uuid4()}",
                system_message="You are a parts catalog assistant. Return only valid JSON arrays.",
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            raw = await chat.send_message(UserMessage(text=prompt))
            # Extract JSON
            import json as _json
            m = re.search(r"\[.*\]", raw, re.DOTALL)
            if m:
                items = _json.loads(m.group(0))
                for it in items:
                    title = str(it.get("title", "")).strip()
                    price = float(it.get("price", 0) or 0)
                    if title and price > 0:
                        results.append(PartResult(
                            title=title[:140],
                            price=price,
                            url=ebay_search_url,
                            image_url=None,
                            source="AI Catalog",
                        ))
        except Exception as e:
            log.warning(f"AI catalog fallback failed: {e}")

    results.sort(key=lambda r: r.price)
    return results


# ---------- History ----------
@api.get("/history/diagnoses")
async def list_diagnoses(user=Depends(current_user)):
    items = await db.diagnoses.find({"user_id": user["id"]}, {"_id": 0}).sort("ts", -1).to_list(100)
    return items


@api.post("/history/diagnoses")
async def save_diagnosis(body: DiagnosisSave, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "session_id": body.session_id,
        "title": body.title,
        "summary": body.summary,
        "vehicle": body.vehicle.dict() if body.vehicle else None,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.diagnoses.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@api.get("/history/shopping")
async def list_shopping(user=Depends(current_user)):
    items = await db.shopping_lists.find({"user_id": user["id"]}, {"_id": 0}).sort("ts", -1).to_list(100)
    return items


@api.post("/history/shopping")
async def save_shopping(body: ShoppingListSave, user=Depends(current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "title": body.title,
        "items": [i.dict() for i in body.items],
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.shopping_lists.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@api.get("/")
async def root():
    return {"service": "MechAnIc API", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
