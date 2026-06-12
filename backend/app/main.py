from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, observations, schools, users

app = FastAPI(title="ObsApp API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(observations.router, prefix="/api")
app.include_router(schools.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "ObsApp API", "docs": "/docs", "health": "/health"}


@app.get("/health")
async def health():
    return {"status": "ok"}
