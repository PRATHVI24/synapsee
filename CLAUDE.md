# Claude Code Configuration

## HL7 Backend Setup

### API Base URL Configuration
The HL7 backend API base URL is configured in:
```
src/services/hl7Api.ts
```

Default setting:
```typescript
const HL7_API_BASE_URL = 'http://localhost:8000';
```

**To change the backend URL:**
1. Open `src/services/hl7Api.ts`
2. Update the `HL7_API_BASE_URL` constant to your backend URL
3. Save the file and restart the development server

### Development Commands
- **Frontend**: `npm run dev` (runs on http://localhost:5173)
- **Backend**: `cd backend/hl7-processor && python app.py` (runs on http://localhost:8000)
- **Linting**: `npm run lint`
- **Type Check**: `npm run build` (includes type checking)

### Backend Requirements
The HL7 backend requires these Python packages:
- fastapi
- hl7apy
- PyMuPDF (fitz)
- pytesseract
- easyocr
- paddleocr
- opencv-python
- pillow
- numpy

### System Requirements
- **Tesseract OCR**: Must be installed and path configured in `app.py`
- **Python 3.8+**: For the FastAPI backend
- **Node.js 16+**: For the React frontend

## Integration Status

### HL7 Document Processor
✅ HL7 to Text conversion
✅ PDF to HL7 conversion
✅ Multi-engine OCR processing
✅ File upload with drag & drop
✅ Error handling and loading states
✅ Backend connectivity testing

### Finance OCR
✅ OCR text extraction from documents
✅ AI-powered invoice data extraction
✅ Invoice approval and storage workflow
✅ Export functionality (CSV/Excel)
✅ Analytics and statistics dashboard
✅ RAG-powered document querying
✅ Real-time processing status tracking
✅ Backend connectivity testing

## Finance OCR Backend Setup

### API Base URL Configuration
The Finance OCR backend API base URL is configured in:
```
src/services/financeApi.ts
```

Default setting:
```typescript
const FINANCE_API_BASE_URL = 'http://localhost:8001';
```

**To change the backend URL:**
1. Open `src/services/financeApi.ts`
2. Update the `FINANCE_API_BASE_URL` constant to your backend URL
3. Save the file and restart the development server

### Development Commands
- **Frontend**: `npm run dev` (runs on http://localhost:5173)
- **HL7 Backend**: `cd backend/hl7-processor && python app.py` (runs on http://localhost:8000)
- **Finance Backend**: `cd backend/FinanceOCR && python -m app.main` (runs on http://localhost:8001)
- **Linting**: `npm run lint`
- **Type Check**: `npm run build` (includes type checking)

### Finance OCR Backend Requirements
The Finance OCR backend requires these Python packages:
- fastapi
- uvicorn
- pydantic
- chromadb
- pytesseract
- opencv-python
- pillow
- numpy
- pandas
- openpyxl
- PyMuPDF (fitz)
- google-generativeai (Gemini AI)

### System Requirements for Finance OCR
- **Tesseract OCR**: Must be installed and accessible
- **Python 3.8+**: For the FastAPI backend
- **ChromaDB**: Vector database for document storage
- **Gemini API Key**: For AI data extraction (set in environment)

### Environment Variables
Create a `.env` file in the Finance OCR backend directory:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
CHROMA_PERSIST_DIRECTORY=./chroma_data
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```