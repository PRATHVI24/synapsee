import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions
import logging
from typing import Optional, List, Dict, Any
import os
from app.config.settings import settings

logger = logging.getLogger(__name__)


class ChromaDBClient:
    def __init__(self):
        self.client: Optional[chromadb.PersistentClient] = None
        self.documents_collection = None
        self.invoices_collection = None
        self.embedding_function = embedding_functions.DefaultEmbeddingFunction()

    async def initialize(self):
        """Initialize ChromaDB client and collections"""
        try:
            # Ensure ChromaDB directory exists
            os.makedirs(settings.chromadb_path, exist_ok=True)

            # Initialize client
            self.client = chromadb.PersistentClient(
                path=settings.chromadb_path,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )

            # Get or create collections
            self.documents_collection = self.client.get_or_create_collection(
                name=settings.documents_collection,
                embedding_function=self.embedding_function,
                metadata={"description": "Collection for storing OCR processed documents"}
            )

            self.invoices_collection = self.client.get_or_create_collection(
                name=settings.invoices_collection,
                embedding_function=self.embedding_function,
                metadata={"description": "Collection for storing approved invoices"}
            )

            logger.info("ChromaDB initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB: {str(e)}")
            return False

    async def add_document(
        self,
        doc_id: str,
        text: str,
        metadata: Dict[str, Any]
    ) -> bool:
        """Add a document to the documents collection"""
        try:
            self.documents_collection.add(
                documents=[text],
                metadatas=[metadata],
                ids=[doc_id]
            )
            logger.info(f"Document {doc_id} added to documents collection")
            return True
        except Exception as e:
            logger.error(f"Failed to add document {doc_id}: {str(e)}")
            return False

    async def add_invoice(
        self,
        invoice_id: str,
        text: str,
        metadata: Dict[str, Any]
    ) -> bool:
        """Add an invoice to the invoices collection"""
        try:
            self.invoices_collection.add(
                documents=[text],
                metadatas=[metadata],
                ids=[invoice_id]
            )
            logger.info(f"Invoice {invoice_id} added to invoices collection")
            return True
        except Exception as e:
            logger.error(f"Failed to add invoice {invoice_id}: {str(e)}")
            return False

    async def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a document by ID"""
        try:
            result = self.documents_collection.get(
                ids=[doc_id],
                include=["documents", "metadatas"]
            )

            if result["ids"]:
                return {
                    "id": result["ids"][0],
                    "document": result["documents"][0],
                    "metadata": result["metadatas"][0]
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get document {doc_id}: {str(e)}")
            return None

    async def get_invoice(self, invoice_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve an invoice by ID"""
        try:
            result = self.invoices_collection.get(
                ids=[invoice_id],
                include=["documents", "metadatas"]
            )

            if result["ids"]:
                return {
                    "id": result["ids"][0],
                    "document": result["documents"][0],
                    "metadata": result["metadatas"][0]
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get invoice {invoice_id}: {str(e)}")
            return None

    async def query_documents(
        self,
        query_text: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Query documents collection for similar content"""
        try:
            results = self.documents_collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where=where,
                include=["documents", "metadatas", "distances"]
            )

            formatted_results = []
            for i in range(len(results["ids"][0])):
                formatted_results.append({
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i]
                })

            return formatted_results
        except Exception as e:
            logger.error(f"Failed to query documents: {str(e)}")
            return []

    async def query_invoices(
        self,
        query_text: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Query invoices collection for similar content"""
        try:
            results = self.invoices_collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where=where,
                include=["documents", "metadatas", "distances"]
            )

            formatted_results = []
            for i in range(len(results["ids"][0])):
                formatted_results.append({
                    "id": results["ids"][0][i],
                    "document": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i]
                })

            return formatted_results
        except Exception as e:
            logger.error(f"Failed to query invoices: {str(e)}")
            return []

    async def list_invoices(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        where: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """List all invoices with optional filtering and pagination"""
        try:
            result = self.invoices_collection.get(
                where=where,
                limit=limit,
                offset=offset,
                include=["documents", "metadatas"]
            )

            invoices = []
            for i in range(len(result["ids"])):
                invoices.append({
                    "id": result["ids"][i],
                    "document": result["documents"][i],
                    "metadata": result["metadatas"][i]
                })

            return invoices
        except Exception as e:
            logger.error(f"Failed to list invoices: {str(e)}")
            return []

    async def count_invoices(self, where: Optional[Dict[str, Any]] = None) -> int:
        """Count total number of invoices"""
        try:
            result = self.invoices_collection.get(where=where, include=[])
            return len(result["ids"])
        except Exception as e:
            logger.error(f"Failed to count invoices: {str(e)}")
            return 0

    async def health_check(self) -> bool:
        """Check if ChromaDB is healthy"""
        try:
            if self.client is None:
                return False

            # Try to list collections
            collections = self.client.list_collections()
            return len(collections) >= 0
        except Exception as e:
            logger.error(f"ChromaDB health check failed: {str(e)}")
            return False


# Global instance
chroma_client = ChromaDBClient()