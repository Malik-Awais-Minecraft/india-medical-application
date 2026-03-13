from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from app.database import Base
from datetime import datetime

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    extracted_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True)
    chunk_index = Column(Integer)
    chunk_text = Column(Text)
    embedding = Column(JSON, nullable=True)  # stored as list of floats
    created_at = Column(DateTime, default=datetime.utcnow)
