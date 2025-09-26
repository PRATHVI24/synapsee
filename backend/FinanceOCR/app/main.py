from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
import logging
import asyncio
import uvicorn
from contextlib import asynccontextmanager
import os

from app.config.settings import settings
from app.db.chromadb_client import chroma_client
from app.models.schemas import HealthCheckResponse, ErrorResponse
from app.routers import ocr, ai, invoices, query

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Finance Document Extractor API...")

    # Initialize ChromaDB
    success = await chroma_client.initialize()
    if not success:
        logger.error("Failed to initialize ChromaDB")
        raise Exception("Database initialization failed")

    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    logger.info(f"Upload directory ready: {settings.upload_dir}")

    logger.info("API startup complete")

    yield

    # Shutdown
    logger.info("Shutting down Finance Document Extractor API...")


# Create FastAPI app
app = FastAPI(
    title=settings.title,
    version=settings.version,
    description=settings.description,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# Custom exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": "An unexpected error occurred while processing your request",
            "timestamp": "2025-01-08T10:00:00Z"  # You might want to use actual timestamp
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "detail": getattr(exc, 'detail', None),
            "timestamp": "2025-01-08T10:00:00Z"  # You might want to use actual timestamp
        }
    )


# Health check endpoint
@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    summary="Health check",
    description="Check the health status of the API and its dependencies"
)
async def health_check():
    """Health check endpoint"""
    try:
        # Check database health
        db_health = await chroma_client.health_check()

        if not db_health:
            raise HTTPException(status_code=503, detail="Database unhealthy")

        return HealthCheckResponse(
            status="healthy",
            version=settings.version
        )

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )


# Root endpoint
@app.get(
    "/",
    tags=["Root"],
    summary="API information",
    description="Get basic information about the Finance Document Extractor API"
)
async def root():
    """Root endpoint with API information"""
    return {
        "name": settings.title,
        "version": settings.version,
        "description": settings.description,
        "docs_url": "/docs",
        "health_check": "/health",
        "endpoints": {
            "OCR": "/ocr/extract - Upload documents for OCR processing",
            "AI Extraction": "/ai/extract - Extract structured data using AI",
            "Invoice Management": "/invoices/ - Manage approved invoices",
            "Query System": "/query/ - RAG-powered document querying"
        }
    }


# Include routers
app.include_router(ocr.router)
app.include_router(ai.router)
app.include_router(invoices.router)
app.include_router(query.router)


# Custom OpenAPI schema
def custom_openapi():
    """Custom OpenAPI schema with additional metadata"""
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=settings.title,
        version=settings.version,
        description=f"""
{settings.description}

## Features

* **OCR Processing**: Upload images/PDFs and extract text with preprocessing
* **AI Data Extraction**: Use Gemini AI to extract structured invoice data
* **Invoice Management**: Approve, store, and export invoice data
* **RAG Query System**: Ask questions about your documents using natural language
* **Vector Database**: ChromaDB integration for semantic search and storage

## Workflow

1. **Upload Document**: Use `/ocr/extract` to upload and process documents
2. **Extract Data**: Use `/ai/extract` to get structured invoice data
3. **Approve Invoice**: Use `/invoices/approve` to store validated invoices
4. **Query Data**: Use `/query/` to ask questions about your documents

## Authentication

Currently, no authentication is required. In production, implement proper
authentication and authorization mechanisms.

## Error Handling

All endpoints return structured error responses with appropriate HTTP status codes:
- 400: Bad Request (validation errors)
- 404: Not Found (resource not found)
- 413: Payload Too Large (file size exceeded)
- 415: Unsupported Media Type (invalid file format)
- 500: Internal Server Error (processing errors)
        """,
        routes=app.routes,
    )

    # Add custom info
    openapi_schema["info"]["contact"] = {
        "name": "Finance Document Extractor API",
        "url": "https://github.com/your-repo/finance-ocr"
    }

    openapi_schema["info"]["license"] = {
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT"
    }

    # Add servers
    openapi_schema["servers"] = [
        {"url": "http://localhost:8000", "description": "Development server"},
        {"url": "https://api.yourserver.com", "description": "Production server"}
    ]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# Development server
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info",
        access_log=True
    )
