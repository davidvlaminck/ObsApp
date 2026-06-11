from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth
from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User

Base.metadata.create_all(bind=engine)

# Seed admin user on startup if database is empty
db = SessionLocal()
try:
    count = db.query(User).count()
    if count == 0:
        admin = User(
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            name="Admin",
            is_superuser=True,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print("Seeded default admin user: admin@example.com / admin")
finally:
    db.close()


app = FastAPI(title="ObsApp API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "ObsApp API", "docs": "/docs", "health": "/health"}

@app.get("/health")
async def health():
    return {"status": "ok"}
