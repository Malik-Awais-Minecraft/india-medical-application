from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models
from app.database import engine
from app.routers import documents

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Residency Companion API", description="API for Residency Companion Phase 1", version="1.0.0")

# Configure CORS for frontend access
origins = [
    "http://localhost",
    "http://localhost:5173", # Vite default port
    # Add other origins if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Residency Companion API"}
