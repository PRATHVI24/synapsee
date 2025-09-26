import google.generativeai as genai
import json
import logging
from typing import Dict, Any, Optional, List
import re
from decimal import Decimal

from app.config.settings import settings
from app.models.schemas import ExtractedInvoiceData, LineItem

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        # Configure Gemini API
        genai.configure(api_key=settings.gemini_api_key)

        # Initialize the model
        self.model = genai.GenerativeModel(settings.gemini_model)

        # Generation config
        self.generation_config = genai.types.GenerationConfig(
            max_output_tokens=settings.max_tokens,
            temperature=settings.temperature
        )

    def _create_extraction_prompt(self, text: str, context: Optional[str] = None) -> str:
        """Create a prompt for extracting structured data from invoice text"""

        base_prompt = f"""
You are an AI assistant specialized in extracting structured data from financial documents, specifically invoices.

Extract the following information from the provided text and return it as a valid JSON object:

Required fields:
- vendor: The name of the vendor/company issuing the invoice
- invoice_number: The invoice number or ID
- date: The invoice date in YYYY-MM-DD format
- line_items: Array of items with description, quantity, unit_price, and total
- subtotal: The subtotal amount (number only, no currency symbols)
- tax: The tax amount (number only, no currency symbols)
- total: The total amount (number only, no currency symbols)
- confidence_scores: Object with confidence scores (0-1) for each extracted field

Instructions:
1. Extract only information that is clearly visible in the text
2. For dates, convert to YYYY-MM-DD format regardless of original format
3. For amounts, extract only the numeric value (remove $, commas, etc.)
4. If a field cannot be found, set it to null
5. For line_items, extract as much detail as possible
6. Provide confidence scores between 0.0 and 1.0 for each field
7. Return ONLY the JSON object, no additional text

Text to process:
{text}
"""

        if context:
            base_prompt += f"\n\nAdditional context from similar documents:\n{context}"

        return base_prompt

    def _create_rag_prompt(self, query: str, context: str) -> str:
        """Create a prompt for RAG-based question answering"""

        return f"""
You are an AI assistant helping users query their financial documents and invoices.

Based on the provided context from their document database, answer the user's question accurately and concisely.

Context from documents:
{context}

User question: {query}

Instructions:
1. Answer based only on the information provided in the context
2. If the context doesn't contain enough information, say so clearly
3. Be specific and provide relevant details when available
4. If mentioning specific invoices or documents, reference them by ID
5. Keep your answer focused and helpful

Answer:
"""

    async def extract_invoice_data(
        self,
        text: str,
        context_documents: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Extract structured invoice data from text using Gemini AI"""
        try:
            # Prepare context if available
            context = None
            if context_documents:
                context_snippets = []
                for doc in context_documents[:3]:  # Limit context size
                    snippet = doc.get('document', '')[:500]  # Truncate for brevity
                    context_snippets.append(f"Document {doc.get('id', 'unknown')}: {snippet}")
                context = "\n\n".join(context_snippets)

            # Create the prompt
            prompt = self._create_extraction_prompt(text, context)

            # Generate response
            response = self.model.generate_content(
                prompt,
                generation_config=self.generation_config
            )

            # Parse the JSON response
            try:
                # Extract JSON from response text
                response_text = response.text.strip()

                # Remove code block markers if present
                if response_text.startswith('```json'):
                    response_text = response_text[7:]
                if response_text.startswith('```'):
                    response_text = response_text[3:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]

                response_text = response_text.strip()

                # Parse JSON
                extracted_data = json.loads(response_text)

                # Validate and process the extracted data
                processed_data = self._process_extracted_data(extracted_data)

                return processed_data

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Response text: {response.text}")

                # Fallback: try to extract data using regex
                return self._fallback_extraction(text)

        except Exception as e:
            logger.error(f"AI extraction failed: {str(e)}")
            raise

    def _process_extracted_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate extracted data"""
        try:
            # Convert line items
            line_items = []
            for item in data.get('line_items', []):
                line_item = LineItem(
                    description=item.get('description', ''),
                    quantity=self._safe_float(item.get('quantity')),
                    unit_price=self._safe_decimal(item.get('unit_price')),
                    total=self._safe_decimal(item.get('total'))
                )
                line_items.append(line_item.dict())

            # Create the structured response
            extracted_data = ExtractedInvoiceData(
                vendor=data.get('vendor'),
                invoice_number=data.get('invoice_number'),
                date=self._normalize_date(data.get('date')),
                line_items=line_items,
                subtotal=self._safe_decimal(data.get('subtotal')),
                tax=self._safe_decimal(data.get('tax')),
                total=self._safe_decimal(data.get('total')),
                confidence_scores=data.get('confidence_scores', {})
            )

            # Calculate overall confidence
            confidence_scores = data.get('confidence_scores', {})
            overall_confidence = sum(confidence_scores.values()) / len(confidence_scores) if confidence_scores else 0.5

            return {
                "extracted_data": extracted_data.dict(),
                "overall_confidence": overall_confidence
            }

        except Exception as e:
            logger.error(f"Error processing extracted data: {str(e)}")
            raise

    def _safe_decimal(self, value: Any) -> Optional[Decimal]:
        """Safely convert value to Decimal"""
        if value is None:
            return None

        try:
            # Handle string values
            if isinstance(value, str):
                # Remove currency symbols and commas
                cleaned = re.sub(r'[^\d.-]', '', value)
                if cleaned:
                    return Decimal(cleaned)

            # Handle numeric values
            if isinstance(value, (int, float)):
                return Decimal(str(value))

            return None
        except (ValueError, TypeError):
            return None

    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float"""
        if value is None:
            return None

        try:
            if isinstance(value, str):
                cleaned = re.sub(r'[^\d.-]', '', value)
                if cleaned:
                    return float(cleaned)

            if isinstance(value, (int, float)):
                return float(value)

            return None
        except (ValueError, TypeError):
            return None

    def _normalize_date(self, date_str: Optional[str]) -> Optional[str]:
        """Normalize date string to YYYY-MM-DD format"""
        if not date_str:
            return None

        try:
            # Common date patterns
            patterns = [
                r'(\d{4})-(\d{1,2})-(\d{1,2})',  # YYYY-MM-DD
                r'(\d{1,2})/(\d{1,2})/(\d{4})',  # MM/DD/YYYY
                r'(\d{1,2})-(\d{1,2})-(\d{4})',  # MM-DD-YYYY
                r'(\d{1,2})\.(\d{1,2})\.(\d{4})', # MM.DD.YYYY
            ]

            for pattern in patterns:
                match = re.search(pattern, date_str)
                if match:
                    groups = match.groups()
                    if len(groups) == 3:
                        # Determine the format and convert
                        if pattern.startswith(r'(\d{4})'):  # YYYY-MM-DD
                            year, month, day = groups
                        else:  # MM/DD/YYYY or similar
                            month, day, year = groups

                        # Format with zero padding
                        return f"{year}-{int(month):02d}-{int(day):02d}"

            # If no pattern matches, return as-is
            return date_str

        except Exception as e:
            logger.warning(f"Date normalization failed for '{date_str}': {str(e)}")
            return date_str

    def _fallback_extraction(self, text: str) -> Dict[str, Any]:
        """Fallback extraction using regex patterns"""
        logger.info("Using fallback extraction method")

        try:
            # Basic regex patterns for common invoice fields
            patterns = {
                'vendor': r'(?i)(?:from|vendor|company|bill to|invoice from)[:\s]+([^\n\r]+)',
                'invoice_number': r'(?i)(?:invoice|inv|#)[:\s#]*(\w+[-\w]*)',
                'date': r'(?i)(?:date|dated)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
                'total': r'(?i)(?:total|amount due)[:\s$]*(\d+\.?\d*)'
            }

            extracted = {}
            confidence_scores = {}

            for field, pattern in patterns.items():
                match = re.search(pattern, text)
                if match:
                    extracted[field] = match.group(1).strip()
                    confidence_scores[field] = 0.7  # Lower confidence for regex extraction
                else:
                    extracted[field] = None
                    confidence_scores[field] = 0.0

            # Create structured response
            extracted_data = ExtractedInvoiceData(
                vendor=extracted.get('vendor'),
                invoice_number=extracted.get('invoice_number'),
                date=self._normalize_date(extracted.get('date')),
                line_items=[],
                subtotal=self._safe_decimal(extracted.get('total')),
                tax=None,
                total=self._safe_decimal(extracted.get('total')),
                confidence_scores=confidence_scores
            )

            overall_confidence = 0.4  # Lower overall confidence for fallback

            return {
                "extracted_data": extracted_data.dict(),
                "overall_confidence": overall_confidence
            }

        except Exception as e:
            logger.error(f"Fallback extraction failed: {str(e)}")
            raise

    async def answer_query(self, query: str, context_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Answer a query using RAG with context from documents"""
        try:
            # Prepare context from documents
            context_parts = []
            references = []

            for doc in context_documents:
                doc_text = doc.get('document', '')
                doc_id = doc.get('id', 'unknown')
                distance = doc.get('distance', 1.0)

                # Add to context
                context_parts.append(f"Document ID: {doc_id}\nContent: {doc_text[:1000]}...")

                # Create reference
                references.append({
                    "id": doc_id,
                    "type": "document" if doc_id.startswith('doc_') else "invoice",
                    "relevance_score": 1.0 - distance,  # Convert distance to relevance
                    "snippet": doc_text[:200] + "..." if len(doc_text) > 200 else doc_text
                })

            context = "\n\n---\n\n".join(context_parts)

            # Create RAG prompt
            prompt = self._create_rag_prompt(query, context)

            # Generate response
            response = self.model.generate_content(
                prompt,
                generation_config=self.generation_config
            )

            # Calculate confidence based on context relevance
            if references:
                avg_relevance = sum(ref["relevance_score"] for ref in references) / len(references)
                confidence = min(avg_relevance + 0.2, 1.0)  # Boost confidence slightly
            else:
                confidence = 0.3  # Low confidence without context

            return {
                "answer": response.text.strip(),
                "references": references[:5],  # Limit references
                "confidence": confidence
            }

        except Exception as e:
            logger.error(f"RAG query failed: {str(e)}")
            raise


# Global instance
ai_service = AIService()