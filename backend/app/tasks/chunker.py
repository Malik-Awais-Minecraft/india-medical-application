import logging
from typing import List
from app.database import SessionLocal
from app import models

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500       # characters per chunk
CHUNK_OVERLAP = 100    # overlap between chunks

def _split_text(text: str) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    text = text.strip()
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks

def _get_embedding_model():
    """Lazy-load the sentence transformer model."""
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("all-MiniLM-L6-v2")
    return model

def chunk_and_embed_document(document_id: int):
    """
    Split a document's extracted_text into chunks, generate embeddings,
    and save them to the DocumentChunk table.
    """
    db = SessionLocal()
    try:
        document = db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document or not document.extracted_text:
            logger.warning(f"Document {document_id} has no extracted text to chunk.")
            return

        logger.info(f"Chunking document {document_id}...")
        chunks = _split_text(document.extracted_text)
        logger.info(f"Created {len(chunks)} chunks for document {document_id}.")

        # Generate embeddings in batch
        model = _get_embedding_model()
        embeddings = model.encode(chunks, show_progress_bar=False)

        # Delete any existing chunks for this document (in case of re-processing)
        db.query(models.DocumentChunk).filter(
            models.DocumentChunk.document_id == document_id
        ).delete()

        # Save new chunks + embeddings
        for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = models.DocumentChunk(
                document_id=document_id,
                chunk_index=i,
                chunk_text=chunk_text,
                embedding=embedding.tolist(),
            )
            db.add(chunk)

        db.commit()
        logger.info(f"Saved {len(chunks)} chunks for document {document_id}.")

    except Exception as e:
        logger.error(f"Error chunking document {document_id}: {e}")
    finally:
        db.close()
