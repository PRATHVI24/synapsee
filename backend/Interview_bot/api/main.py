"""FastAPI service exposing AI Interview Bot endpoints.

This service provides the REST endpoints that the unified frontend expects
for the Interview Bot integration. It keeps state in a JSON file on disk so
you can test the UI without deploying a full database or LiveKit stack.

Run locally with:

    uvicorn backend.Interview_bot.api.main:app --host 0.0.0.0 --port 8002 --reload

Environment variables you can set to customise behaviour:
    LIVEKIT_URL            – optional, LiveKit server URL returned from /start
    LIVEKIT_TEST_TOKEN     – optional, LiveKit token returned from /start

If you later integrate with a real LiveKit deployment you can replace the
`generate_livekit_credentials` helper with real token generation logic.
"""

from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

try:
    from livekit import api as livekit_api  # type: ignore
except ImportError:  # pragma: no cover - optional LiveKit SDK
    livekit_api = None


# ---------------------------------------------------------------------------
# Pydantic models (mirroring the types used on the frontend)


class InterviewSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=None)

    duration: int = 60
    duration_unit: str = Field("minutes", alias="durationUnit")
    topics: List[str] = Field(default_factory=list)
    difficulty: str = "mid"
    include_video: bool = Field(True, alias="includeVideo")
    include_audio: Optional[bool] = Field(True, alias="includeAudio")
    auto_evaluation: bool = Field(True, alias="autoEvaluation")
    language: Optional[str] = None
    timezone: Optional[str] = None
    reminders_enabled: Optional[bool] = Field(False, alias="remindersEnabled")


class InterviewEvaluation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    overall_score: int = Field(..., alias="overallScore")
    technical_score: int = Field(..., alias="technicalScore")
    communication_score: int = Field(..., alias="communicationScore")
    problem_solving_score: int = Field(..., alias="problemSolvingScore")
    feedback: str
    recommendations: List[str]


class InterviewTranscriptEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    timestamp: datetime
    speaker: str
    text: str


class InterviewLiveStatus(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    started_at: Optional[datetime] = Field(None, alias="startedAt")
    ended_at: Optional[datetime] = Field(None, alias="endedAt")
    progress_percent: Optional[float] = Field(None, alias="progressPercent")
    remaining_seconds: Optional[int] = Field(None, alias="remainingSeconds")
    current_topic: Optional[str] = Field(None, alias="currentTopic")


class Interview(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    candidate_name: str = Field(..., alias="candidateName")
    position: str
    scheduled_at: datetime = Field(..., alias="scheduledAt")
    duration: int
    status: str
    job_description: Optional[str] = Field(None, alias="jobDescription")
    resume: Optional[str] = None
    settings: Optional[InterviewSettings] = None
    live_status: Optional[InterviewLiveStatus] = Field(None, alias="liveStatus")
    transcript_entries: List[InterviewTranscriptEntry] = Field(
        default_factory=list, alias="transcriptEntries"
    )
    evaluation: Optional[InterviewEvaluation] = None
    created_at: datetime = Field(default_factory=lambda: now_utc(), alias="createdAt")
    updated_at: datetime = Field(default_factory=lambda: now_utc(), alias="updatedAt")


class LiveKitCredentials(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str
    url: str
    room_name: str = Field(..., alias="roomName")
    participant_identity: str = Field(..., alias="participantIdentity")


class InterviewTemplate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    role: str
    description: Optional[str] = None
    settings: InterviewSettings
    updated_at: datetime = Field(default_factory=lambda: now_utc(), alias="updatedAt")


class InterviewMetrics(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_interviews: int = Field(..., alias="totalInterviews")
    active_interviews: int = Field(..., alias="activeInterviews")
    completion_rate: float = Field(..., alias="completionRate")
    average_score: Optional[float] = Field(None, alias="averageScore")
    average_duration: Optional[float] = Field(None, alias="averageDuration")
    interviews_by_role: List[Dict[str, Any]] = Field(
        default_factory=list, alias="interviewsByRole"
    )


class CreateInterviewPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    candidate_name: str = Field(..., alias="candidateName")
    position: str
    duration: int = 60
    scheduled_at: Optional[datetime] = Field(None, alias="scheduledAt")
    job_description: Optional[str] = Field(None, alias="jobDescription")
    resume: Optional[str] = None
    settings: Optional[InterviewSettings] = None
    metadata: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Storage helpers


DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_FILE = DATA_DIR / "interviews.json"

store_lock = asyncio.Lock()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_state() -> List[Interview]:
    if not DATA_FILE.exists():
        return []

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    interviews: List[Interview] = []
    for item in data:
        interviews.append(Interview.model_validate(item))
    return interviews


def write_state(interviews: List[Interview]) -> None:
    payload = [item.model_dump(mode="json", by_alias=True) for item in interviews]
    DATA_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")


async def load_interviews() -> List[Interview]:
    async with store_lock:
        return read_state()


async def save_interviews(interviews: List[Interview]) -> None:
    async with store_lock:
        write_state(interviews)


def generate_default_interviews() -> List[Interview]:
    sample_settings = InterviewSettings(
        duration=45,
        topics=["Python", "Machine Learning", "System Design"],
        difficulty="senior",
    )
    sample_interview = Interview(
        id=str(uuid.uuid4()),
        candidateName="Sample Candidate",
        position="Senior AI Engineer",
        scheduledAt=now_utc(),
        duration=45,
        status="scheduled",
        jobDescription="Placeholder JD sourced from ai_2_1.py sample data.",
        settings=sample_settings,
    )
    return [sample_interview]


def ensure_seed_data() -> None:
    ensure_data_dir()
    if not DATA_FILE.exists():
        write_state(generate_default_interviews())


# ---------------------------------------------------------------------------
# Business helpers


def generate_livekit_credentials(interview: Interview) -> LiveKitCredentials:
    """Return LiveKit credentials. Falls back to mock values for testing."""
    import time

    livekit_url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    preissued_token = os.getenv("LIVEKIT_TOKEN") or os.getenv("LIVEKIT_TEST_TOKEN")

    participant_identity = (
        f"candidate-{interview.candidate_name.lower().replace(' ', '-')}-{interview.id[:8]}"
    )
    room_name = f"interview-{interview.id}"

    # Debug logging
    print(f"LiveKit Configuration:")
    print(f"  URL: {livekit_url}")
    print(f"  API Key: {api_key[:10]}..." if api_key else "  API Key: None")
    print(f"  API Secret: {'*' * 10 if api_secret else 'None'}")
    print(f"  Room: {room_name}")
    print(f"  Identity: {participant_identity}")

    # Prefer explicit token provided via env var
    if preissued_token and livekit_url:
        print(f"Using pre-issued token")
        return LiveKitCredentials(
            token=preissued_token,
            url=livekit_url,
            roomName=room_name,
            participantIdentity=participant_identity,
        )

    # If LiveKit server credentials are available, generate a token dynamically
    if livekit_url and api_key and api_secret and livekit_api:
        try:
            token_builder = livekit_api.AccessToken(api_key, api_secret)
            token_builder.identity = participant_identity
            token_builder.name = interview.candidate_name
            
            # Set token expiration (6 hours from now)
            import datetime
            token_builder.ttl = datetime.timedelta(hours=6)
            
            # Set grants with all necessary permissions
            token_builder = token_builder.with_grants(livekit_api.VideoGrants(
                room_join=True,
                room_create=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
                can_update_own_metadata=True,
            ))
            
            token = token_builder.to_jwt()
            print(f"Generated JWT token successfully")
            print(f"Token (first 50 chars): {token[:50]}...")
            
            # Decode token to verify claims (for debugging)
            try:
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                print(f"Token claims: {json.dumps(decoded, indent=2)}")
            except Exception as decode_err:
                print(f"Could not decode token for debugging: {decode_err}")
                
            return LiveKitCredentials(
                token=token,
                url=livekit_url,
                roomName=room_name,
                participantIdentity=participant_identity,
            )
        except Exception as e:
            print(f"LiveKit token generation failed: {e}")
            import traceback
            traceback.print_exc()

    # Fallback for local UI testing without a LiveKit deployment
    print(f"Missing LiveKit configuration, using mock token")
    print(f"  URL present: {bool(livekit_url)}")
    print(f"  API Key present: {bool(api_key)}")
    print(f"  API Secret present: {bool(api_secret)}")
    print(f"  livekit_api module: {livekit_api is not None}")
    
    fallback_url = livekit_url or "wss://demo.livekit.io"
    fallback_token = f"mock-token-{uuid.uuid4()}"

    return LiveKitCredentials(
        token=fallback_token,
        url=fallback_url,
        roomName=room_name,
        participantIdentity=participant_identity,
    )


def calculate_metrics(interviews: List[Interview]) -> InterviewMetrics:
    total = len(interviews)
    active = len([item for item in interviews if item.status in {"in_progress", "preparing"}])
    completed = len([item for item in interviews if item.status == "completed"])

    completion_rate = completed / total if total else 0.0
    average_duration = (
        sum(item.duration for item in interviews) / total if total else None
    )

    role_totals: Dict[str, Dict[str, Any]] = {}
    for interview in interviews:
        role = interview.position
        bucket = role_totals.setdefault(role, {"role": role, "count": 0, "averageScore": None})
        bucket["count"] += 1

    return InterviewMetrics(
        totalInterviews=total,
        activeInterviews=active,
        completionRate=completion_rate,
        averageScore=None,
        averageDuration=average_duration,
        interviewsByRole=list(role_totals.values()),
    )


def build_templates() -> List[InterviewTemplate]:
    base_settings = InterviewSettings(
        duration=60,
        topics=["React", "TypeScript", "System Design"],
        difficulty="mid",
    )
    advanced_settings = InterviewSettings(
        duration=75,
        topics=["Python", "LLM Ops", "RAG Architecture"],
        difficulty="senior",
    )

    return [
        InterviewTemplate(
            id="template-frontend",
            name="Frontend Engineer",
            role="Frontend Engineer",
            description="Covers UI fundamentals, performance, and accessibility.",
            settings=base_settings,
        ),
        InterviewTemplate(
            id="template-llm",
            name="LLM Engineer",
            role="LLM Engineer",
            description="Focus on LLM deployment, prompt engineering, and RAG.",
            settings=advanced_settings,
        ),
    ]


async def find_interview(interview_id: UUID) -> Interview:
    interview_id_str = str(interview_id)
    interviews = await load_interviews()
    for entry in interviews:
        if entry.id == interview_id_str:
            return entry
    raise HTTPException(status_code=404, detail="Interview not found")


async def upsert_interview(updated: Interview) -> Interview:
    interviews = await load_interviews()
    replaced = False
    for index, entry in enumerate(interviews):
        if entry.id == updated.id:
            interviews[index] = updated
            replaced = True
            break

    if not replaced:
        interviews.append(updated)

    await save_interviews(interviews)
    return updated


# ---------------------------------------------------------------------------
# FastAPI app and routes


app = FastAPI(title="AI Interview Bot API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:  # pragma: no cover - simple startup hook
    ensure_seed_data()


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok", "time": now_utc().isoformat()}


@app.get("/interviews", response_model=List[Interview])
async def list_interviews() -> List[Interview]:
    return await load_interviews()


@app.post("/interviews", response_model=Interview, status_code=201)
async def create_interview(payload: CreateInterviewPayload) -> Interview:
    interview = Interview(
        id=str(uuid.uuid4()),
        candidateName=payload.candidate_name,
        position=payload.position,
        duration=payload.duration,
        scheduledAt=payload.scheduled_at or now_utc(),
        status="scheduled",
        jobDescription=payload.job_description,
        resume=payload.resume,
        settings=payload.settings,
    )
    await upsert_interview(interview)
    return interview


@app.get("/interviews/metrics", response_model=InterviewMetrics)
async def get_metrics() -> InterviewMetrics:
    interviews = await load_interviews()
    return calculate_metrics(interviews)


@app.get("/interviews/{interview_id:uuid}", response_model=Interview)
async def get_interview(interview_id: UUID) -> Interview:
    return await find_interview(interview_id)


@app.post("/interviews/{interview_id:uuid}/start", response_model=LiveKitCredentials)
async def start_interview(interview_id: UUID) -> LiveKitCredentials:
    interview = await find_interview(interview_id)

    interview.status = "in_progress"
    current_topic = (
        interview.settings.topics[0] if interview.settings and interview.settings.topics else None
    )

    interview.live_status = InterviewLiveStatus(
        status="in_progress",
        startedAt=now_utc(),
        progressPercent=0.0,
        remainingSeconds=interview.duration * 60,
        currentTopic=current_topic,
    )
    interview.updated_at = now_utc()
    await upsert_interview(interview)

    return generate_livekit_credentials(interview)


@app.post("/interviews/{interview_id:uuid}/stop")
async def stop_interview(interview_id: UUID) -> Dict[str, str]:
    interview = await find_interview(interview_id)

    interview.status = "completed"
    interview.live_status = InterviewLiveStatus(
        status="completed",
        startedAt=interview.live_status.started_at if interview.live_status else None,
        endedAt=now_utc(),
        progressPercent=100.0,
        remainingSeconds=0,
    )
    interview.updated_at = now_utc()
    await upsert_interview(interview)

    return {"status": "stopped"}


@app.get("/interviews/{interview_id:uuid}/status", response_model=InterviewLiveStatus)
async def get_interview_status(interview_id: UUID) -> InterviewLiveStatus:
    interview = await find_interview(interview_id)

    if interview.live_status is None:
        return InterviewLiveStatus(status=interview.status)

    if interview.live_status.started_at and interview.status == "in_progress":
        elapsed = (now_utc() - interview.live_status.started_at).total_seconds()
        total_seconds = interview.duration * 60
        progress = min(100.0, (elapsed / total_seconds) * 100) if total_seconds else 0.0
        remaining = max(0, int(total_seconds - elapsed))
        interview.live_status.progress_percent = progress
        interview.live_status.remaining_seconds = remaining

    return interview.live_status


@app.get("/interviews/{interview_id:uuid}/transcript")
async def download_transcript(interview_id: UUID) -> JSONResponse:
    interview = await find_interview(interview_id)

    content = {
        "interviewId": interview.id,
        "candidate": interview.candidate_name,
        "entries": [
            entry.model_dump(mode="json", by_alias=True)
            for entry in interview.transcript_entries
        ],
    }
    return JSONResponse(content=content)


@app.get("/templates", response_model=List[InterviewTemplate])
async def list_templates() -> List[InterviewTemplate]:
    return build_templates()


# ---------------------------------------------------------------------------


