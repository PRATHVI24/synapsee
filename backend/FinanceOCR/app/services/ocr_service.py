import cv2
import numpy as np
import pytesseract
import logging
from PIL import Image, ImageEnhance
from typing import Tuple, Optional
import io
import fitz  # PyMuPDF for PDF processing
import re
import uuid
from datetime import datetime

from app.config.settings import settings

logger = logging.getLogger(__name__)


class OCRService:
    def __init__(self):
        self.tesseract_config = settings.tesseract_config

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Apply preprocessing steps to improve OCR accuracy"""
        try:
            # Convert to grayscale if not already
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()

            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (1, 1), 0)

            # Detect and correct skew
            corrected = self._correct_skew(blurred)

            # Enhance contrast
            enhanced = self._enhance_contrast(corrected)

            # Apply morphological operations to clean up text
            cleaned = self._morphological_cleaning(enhanced)

            return cleaned

        except Exception as e:
            logger.error(f"Error in image preprocessing: {str(e)}")
            return image

    def _correct_skew(self, image: np.ndarray) -> np.ndarray:
        """Detect and correct skew in the image"""
        try:
            # Apply edge detection
            edges = cv2.Canny(image, 50, 150, apertureSize=3)

            # Detect lines using HoughLines
            lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)

            if lines is not None:
                # Calculate the most common angle
                angles = []
                for rho, theta in lines[:, 0]:
                    angle = theta * 180 / np.pi
                    if angle < 45:
                        angles.append(angle)
                    elif angle > 135:
                        angles.append(angle - 180)

                if angles:
                    median_angle = np.median(angles)

                    # Only correct if the skew is significant
                    if abs(median_angle) > 0.5:
                        # Get rotation matrix
                        (h, w) = image.shape
                        center = (w // 2, h // 2)
                        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)

                        # Apply rotation
                        corrected = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                        return corrected

            return image

        except Exception as e:
            logger.warning(f"Skew correction failed: {str(e)}")
            return image

    def _enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Enhance contrast using CLAHE"""
        try:
            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(image)
            return enhanced
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {str(e)}")
            return image

    def _morphological_cleaning(self, image: np.ndarray) -> np.ndarray:
        """Apply morphological operations to clean up text"""
        try:
            # Create kernels for morphological operations
            kernel = np.ones((1, 1), np.uint8)

            # Apply morphological opening to remove noise
            opened = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)

            # Apply morphological closing to connect text components
            closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)

            return closed

        except Exception as e:
            logger.warning(f"Morphological cleaning failed: {str(e)}")
            return image

    def extract_text_from_image(self, image_bytes: bytes) -> Tuple[str, float]:
        """Extract text from image bytes using OCR"""
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if image is None:
                raise ValueError("Invalid image data")

            # Preprocess the image
            processed_image = self.preprocess_image(image)

            # Extract text using Tesseract
            text = pytesseract.image_to_string(processed_image, config=self.tesseract_config)

            # Get confidence score
            data = pytesseract.image_to_data(processed_image, output_type=pytesseract.Output.DICT, config=self.tesseract_config)
            confidences = [int(conf) for conf in data['conf'] if int(conf) > 0]
            avg_confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0

            return text.strip(), avg_confidence

        except Exception as e:
            logger.error(f"OCR extraction failed: {str(e)}")
            raise

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> Tuple[str, float]:
        """Extract text from PDF bytes"""
        try:
            # Open PDF document
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            all_text = []
            total_confidence = 0.0
            page_count = 0

            for page_num in range(doc.page_count):
                page = doc.load_page(page_num)

                # First try to extract text directly
                page_text = page.get_text()

                if page_text.strip():
                    # If text is available, use it directly
                    all_text.append(page_text)
                    total_confidence += 0.95  # High confidence for native PDF text
                else:
                    # If no text, render page as image and use OCR
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                    img_bytes = pix.tobytes("png")

                    ocr_text, ocr_confidence = self.extract_text_from_image(img_bytes)
                    all_text.append(ocr_text)
                    total_confidence += ocr_confidence

                page_count += 1

            doc.close()

            combined_text = "\n\n".join(all_text)
            avg_confidence = total_confidence / page_count if page_count > 0 else 0.0

            return combined_text.strip(), avg_confidence

        except Exception as e:
            logger.error(f"PDF text extraction failed: {str(e)}")
            raise

    def clean_extracted_text(self, text: str) -> str:
        """Clean and normalize extracted text"""
        try:
            # Remove excessive whitespace
            cleaned = re.sub(r'\s+', ' ', text)

            # Remove special characters that might interfere with processing
            cleaned = re.sub(r'[^\w\s\-.,()$:/]', '', cleaned)

            # Normalize common OCR errors
            corrections = {
                'O': '0',  # Letter O to number 0 in numeric contexts
                'l': '1',  # Letter l to number 1 in numeric contexts
                'S': '5',  # Letter S to number 5 in numeric contexts
            }

            # Apply corrections cautiously (only in numeric contexts)
            # This is a simplified approach - in production, you'd want more sophisticated logic
            words = cleaned.split()
            corrected_words = []

            for word in words:
                # Check if word looks like it should be numeric
                if re.match(r'^[\dOlS.,]+$', word):
                    corrected_word = word
                    for old, new in corrections.items():
                        corrected_word = corrected_word.replace(old, new)
                    corrected_words.append(corrected_word)
                else:
                    corrected_words.append(word)

            cleaned = ' '.join(corrected_words)

            return cleaned.strip()

        except Exception as e:
            logger.warning(f"Text cleaning failed: {str(e)}")
            return text

    async def process_document(self, file_bytes: bytes, filename: str, content_type: str) -> dict:
        """Main method to process a document and return OCR results"""
        try:
            # Generate unique document ID
            doc_id = f"doc_{uuid.uuid4().hex[:12]}"

            # Extract text based on file type
            if content_type.startswith('image/'):
                raw_text, confidence = self.extract_text_from_image(file_bytes)
            elif content_type == 'application/pdf':
                raw_text, confidence = self.extract_text_from_pdf(file_bytes)
            else:
                raise ValueError(f"Unsupported file type: {content_type}")

            # Clean the extracted text
            cleaned_text = self.clean_extracted_text(raw_text)

            # Prepare document metadata
            metadata = {
                "file_name": filename,
                "file_type": content_type,
                "upload_date": datetime.utcnow().isoformat(),
                "raw_text": raw_text,
                "cleaned_text": cleaned_text,
                "document_type": "invoice",  # Default assumption
                "confidence_score": confidence,
                "file_size": len(file_bytes)
            }

            return {
                "doc_id": doc_id,
                "raw_text": raw_text,
                "cleaned_text": cleaned_text,
                "confidence": confidence,
                "metadata": metadata
            }

        except Exception as e:
            logger.error(f"Document processing failed: {str(e)}")
            raise


# Global instance
ocr_service = OCRService()