from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.core.limiter import limiter
from app.routers.auth import router as auth_router
from app.routers.risk import router as risk_router
from app.routers.scheme import router as scheme_router
from app.routers.user_scheme import router as user_scheme_router
from app.routers.admin import router as admin_router
from app.routers.assessment_plan import router as assessment_plan_router
from app.services import risk_service

from app.core.init_db import seed_admin

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup check
    risk_service.startup_check()
    
    # Seed admin user if requested
    seed_admin()
    
    yield

app = FastAPI(title="FinShield API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Open to any origin with credential support.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(risk_router)
app.include_router(scheme_router)
app.include_router(user_scheme_router)
app.include_router(admin_router)
app.include_router(assessment_plan_router)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}
