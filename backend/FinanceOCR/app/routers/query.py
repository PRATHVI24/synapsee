from fastapi import APIRouter, HTTPException
import logging

from app.models.schemas import (
    RAGQueryRequest,
    RAGQueryResponse,
    RAGReference,
    ErrorResponse
)
from app.services.ai_service import ai_service
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query", tags=["RAG Query System"])


@router.post(
    "/",
    response_model=RAGQueryResponse,
    summary="Query documents and invoices using RAG",
    description="""
    Ask questions about your documents and invoices using RAG (Retrieval-Augmented Generation).

    The system will:
    1. Search relevant documents/invoices using vector similarity
    2. Use the found context to generate accurate answers with Gemini AI
    3. Return the answer along with supporting references

    Query types supported:
    - "all": Search both documents and invoices (default)
    - "documents": Search only uploaded documents
    - "invoices": Search only approved invoices

    Example queries:
    - "What invoices are from ABC Company?"
    - "Show me all invoices over $1000"
    - "What documents were processed last month?"
    - "Calculate total expenses for office supplies"
    """
)
async def query_documents(request: RAGQueryRequest):
    """Query documents and invoices using RAG"""
    try:
        logger.info(f"RAG query received: '{request.query}' (context: {request.context_type})")

        # Search for relevant context based on context_type
        context_documents = []

        if request.context_type == "documents":
            context_documents = await db_service.search_documents(
                query=request.query,
                limit=request.limit
            )
        elif request.context_type == "invoices":
            context_documents = await db_service.search_invoices(
                query=request.query,
                limit=request.limit
            )
        elif request.context_type == "all":
            context_documents = await db_service.search_all(
                query=request.query,
                limit=request.limit
            )

        logger.info(f"Found {len(context_documents)} relevant documents for context")

        if not context_documents:
            return RAGQueryResponse(
                answer="I couldn't find any relevant documents or invoices to answer your question. Please make sure you have uploaded and processed some documents first.",
                references=[],
                confidence=0.1
            )

        # Use AI service to generate answer
        result = await ai_service.answer_query(
            query=request.query,
            context_documents=context_documents
        )

        # Convert references to proper format
        references = []
        for ref in result["references"]:
            rag_ref = RAGReference(
                id=ref["id"],
                type=ref["type"],
                relevance_score=ref["relevance_score"],
                snippet=ref["snippet"]
            )
            references.append(rag_ref)

        response = RAGQueryResponse(
            answer=result["answer"],
            references=references,
            confidence=result["confidence"]
        )

        logger.info(f"RAG query completed with confidence: {response.confidence}")

        return response

    except Exception as e:
        logger.error(f"RAG query failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Query processing failed: {str(e)}"
        )


@router.post(
    "/similar-documents",
    summary="Find similar documents",
    description="""
    Find documents similar to a given query or document content.

    This endpoint is useful for:
    - Finding duplicate or similar invoices
    - Discovering documents with similar content
    - Content-based document clustering

    Returns documents ranked by similarity score.
    """
)
async def find_similar_documents(request: RAGQueryRequest):
    """Find documents similar to the query"""
    try:
        logger.info(f"Finding similar documents for: '{request.query}' (context: {request.context_type})")

        # Search for similar documents
        if request.context_type == "documents":
            similar_docs = await db_service.search_documents(
                query=request.query,
                limit=request.limit
            )
        elif request.context_type == "invoices":
            similar_docs = await db_service.search_invoices(
                query=request.query,
                limit=request.limit
            )
        elif request.context_type == "all":
            similar_docs = await db_service.search_all(
                query=request.query,
                limit=request.limit
            )

        if not similar_docs:
            return {
                "query": request.query,
                "similar_documents": [],
                "message": "No similar documents found"
            }

        # Format results
        formatted_results = []
        for doc in similar_docs:
            formatted_doc = {
                "id": doc["id"],
                "type": doc.get("type", "document" if doc["id"].startswith("doc_") else "invoice"),
                "similarity_score": 1.0 - doc.get("distance", 1.0),  # Convert distance to similarity
                "content_preview": doc["document"][:300] + "..." if len(doc["document"]) > 300 else doc["document"],
                "metadata": doc.get("metadata", {})
            }
            formatted_results.append(formatted_doc)

        logger.info(f"Found {len(formatted_results)} similar documents")

        return {
            "query": request.query,
            "similar_documents": formatted_results,
            "total_found": len(formatted_results)
        }

    except Exception as e:
        logger.error(f"Similar document search failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Similar document search failed: {str(e)}"
        )


@router.get(
    "/suggestions",
    summary="Get query suggestions",
    description="""
    Get suggested queries based on available documents and invoices.

    This endpoint analyzes your document collection and suggests
    useful queries you can ask about your data.
    """
)
async def get_query_suggestions():
    """Get suggested queries based on available data"""
    try:
        logger.info("Generating query suggestions")

        # Get some sample invoices to analyze
        invoices, _ = await db_service.list_invoices(page=1, limit=5)

        suggestions = [
            "What is the total amount of all invoices?",
            "Show me invoices from the last month",
            "Which vendor has the highest total amount?",
            "List all invoices over $500",
            "What are the most common line items?",
            "Show me all pending invoices",
            "Calculate average invoice amount by vendor",
            "Find duplicate invoices",
            "What documents have low OCR confidence scores?",
            "Show me all invoices with tax amounts"
        ]

        # Add dynamic suggestions based on actual data
        dynamic_suggestions = []

        if invoices:
            # Add vendor-specific suggestions
            unique_vendors = list(set(invoice.vendor for invoice in invoices[:3]))
            for vendor in unique_vendors:
                dynamic_suggestions.append(f"Show me all invoices from {vendor}")

            # Add date-based suggestions
            dynamic_suggestions.append("What invoices were processed this year?")

        all_suggestions = suggestions + dynamic_suggestions

        logger.info(f"Generated {len(all_suggestions)} query suggestions")

        return {
            "suggestions": all_suggestions,
            "categories": {
                "financial": [s for s in suggestions if any(word in s.lower() for word in ["amount", "total", "calculate", "average"])],
                "vendor": [s for s in suggestions if "vendor" in s.lower()] + [s for s in dynamic_suggestions if "from" in s],
                "time_based": [s for s in suggestions if any(word in s.lower() for word in ["month", "last", "year"])],
                "analysis": [s for s in suggestions if any(word in s.lower() for word in ["duplicate", "confidence", "common"])]
            }
        }

    except Exception as e:
        logger.error(f"Failed to generate query suggestions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate suggestions: {str(e)}"
        )


@router.post(
    "/explain",
    summary="Explain query results",
    description="""
    Get a detailed explanation of how a query was processed and
    why certain results were returned.

    This is useful for understanding the RAG system's decision-making
    process and improving query effectiveness.
    """
)
async def explain_query(request: RAGQueryRequest):
    """Explain how a query is processed"""
    try:
        logger.info(f"Explaining query: '{request.query}'")

        # Search for context documents
        if request.context_type == "all":
            context_documents = await db_service.search_all(
                query=request.query,
                limit=request.limit
            )
        elif request.context_type == "documents":
            context_documents = await db_service.search_documents(
                query=request.query,
                limit=request.limit
            )
        else:  # invoices
            context_documents = await db_service.search_invoices(
                query=request.query,
                limit=request.limit
            )

        # Analyze the query and context
        explanation = {
            "query_analysis": {
                "original_query": request.query,
                "query_length": len(request.query),
                "context_type": request.context_type,
                "search_limit": request.limit
            },
            "search_results": {
                "documents_found": len(context_documents),
                "search_strategy": f"Vector similarity search in {request.context_type} collection(s)",
                "relevance_scores": [
                    {
                        "document_id": doc["id"],
                        "similarity_score": 1.0 - doc.get("distance", 1.0),
                        "content_length": len(doc["document"])
                    }
                    for doc in context_documents[:3]  # Top 3 for explanation
                ]
            },
            "processing_steps": [
                "1. Query text is converted to vector embeddings",
                "2. Vector similarity search finds relevant documents",
                "3. Top matching documents provide context",
                "4. Gemini AI generates answer using retrieved context",
                "5. Confidence score calculated based on context relevance"
            ],
            "recommendations": []
        }

        # Add recommendations based on analysis
        if len(context_documents) == 0:
            explanation["recommendations"].append("No relevant documents found. Try broader search terms or upload more documents.")
        elif len(context_documents) < 3:
            explanation["recommendations"].append("Few relevant documents found. Consider rephrasing your query or adding more documents.")
        else:
            explanation["recommendations"].append("Good context found. Query should produce accurate results.")

        if len(request.query.split()) < 3:
            explanation["recommendations"].append("Short query detected. More specific queries often yield better results.")

        logger.info("Query explanation generated successfully")

        return explanation

    except Exception as e:
        logger.error(f"Query explanation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Query explanation failed: {str(e)}"
        )