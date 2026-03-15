from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models
from app.database import engine
from app.routers import documents, qa, auth, alerts

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Residency Companion API",
    description="AI-Powered Medical Decision Support for India — Phase 3",
    version="3.0.0"
)

origins = [
    "http://localhost",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(alerts.router)
app.include_router(documents.router)
app.include_router(qa.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Residency Companion API v3"}
