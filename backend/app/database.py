from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

# We will use SQLite for local MVP instead of PostgreSQL to avoid Docker dependency for now.
# In a real staging/prod environment, this should be replaced with a proper PostgreSQL URL.
SQLALCHEMY_DATABASE_URL = "sqlite:///./residency.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
