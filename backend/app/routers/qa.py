import os
import logging
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/qa", tags=["Q&A"])


class QuestionRequest(BaseModel):
    question: str
    document_ids: list[int] | None = None


def cosine_similarity(a: list, b: list) -> float:
    a, b = np.array(a), np.array(b)
    norm_a, norm_b = np.linalg.norm(a), np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _get_embedding_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


@router.post("/")
def ask_question(request: QuestionRequest, db: Session = Depends(get_db)):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # 1. Embed the question
    model = _get_embedding_model()
    question_embedding = model.encode(question).tolist()

    # 2. Load chunks from DB
    if request.document_ids:
        chunks = db.query(models.DocumentChunk).filter(models.DocumentChunk.document_id.in_(request.document_ids)).all()
        if not chunks:
            return {
                "answer": "No content found for the selected documents.",
                "sources": [],
                "related_lines": []
            }
    else:
        chunks = db.query(models.DocumentChunk).all()
        if not chunks:
            return {
                "answer": "No documents have been ingested yet. Please upload some medical guidelines first.",
                "sources": [],
                "related_lines": []
            }

    # 3. Rank by cosine similarity
    scored = []
    for chunk in chunks:
        if chunk.embedding:
            score = cosine_similarity(question_embedding, chunk.embedding)
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored[:5]

    # 4. Build context for GPT
    context_parts = []
    sources = []
    fallback_related_lines = []
    for score, chunk in top_chunks:
        doc = db.query(models.Document).filter(models.Document.id == chunk.document_id).first()
        doc_name = doc.filename if doc else "Unknown"
        context_parts.append(f"[Source: {doc_name}]\n{chunk.chunk_text}")
        fallback_related_lines.append({"text": chunk.chunk_text, "source": doc_name})
        if doc_name not in sources:
            sources.append(doc_name)

    context = "\n\n---\n\n".join(context_parts)

    # 5. Call OpenAI
    from dotenv import load_dotenv
    import json
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key or api_key == "your-api-key-here":
        # Return context-only response when no key is set
        return {
            "answer": "⚠️ OpenAI API key not configured. Here are the most relevant passages found:\n\n" + context,
            "sources": sources,
            "related_lines": fallback_related_lines
        }

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        system_prompt = (
            "You are a medical information assistant for Indian physicians. "
            "Answer the question below using EXCLUSIVELY the provided context from medical guidelines. "
            "If the answer is NOT explicitly contained within the provided context, you MUST explicitly state 'I cannot answer this question based on the provided documents.' "
            "UNDER NO CIRCUMSTANCES should you use outside knowledge, guess, or provide information beyond the scope of the provided text. "
            "Be precise, cite your sources by document name, and add a disclaimer that this is "
            "for reference only and clinical judgment must be applied.\n"
            "You MUST respond ONLY with a JSON object possessing exactly two keys:\n"
            "\"answer\": your detailed final text response.\n"
            "\"quotes\": a list of objects, each with \"text\" for the exact sentence you reproduced from the context, and \"source\" for the document name it comes from."
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
            ],
            temperature=0.2,
            max_tokens=1500,
        )

        result_content = response.choices[0].message.content
        try:
            parsed = json.loads(result_content)
            answer = parsed.get("answer", "No answer generated.")
            related_lines = parsed.get("quotes", [])
            
            # Map the actual cited sources from the generated quotes
            actual_sources = []
            if related_lines:
                for quote in related_lines:
                    # Some quotes might not have a source attached if model hallucinates schema slightly
                    src = quote.get("source")
                    if src and src not in actual_sources:
                        actual_sources.append(src)
                sources = actual_sources
            elif "cannot answer" in answer.lower() or "cannot provide" in answer.lower():
                sources = []
                
        except json.JSONDecodeError:
            answer = result_content
            related_lines = []
            if "cannot answer" in answer.lower() or "cannot provide" in answer.lower():
                sources = []

    except Exception as e:
        logger.error(f"OpenAI call failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")

    return {"answer": answer, "sources": sources, "related_lines": related_lines}
