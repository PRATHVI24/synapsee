# Finance Document Extractor - FastAPI Backend

A complete **AI-powered document processing system** that extracts structured data from financial documents using OCR and Google Gemini AI integration, built with FastAPI.

## 🚀 Features

- **OCR Processing**: Extract text from images and PDFs with advanced preprocessing
- **AI Data Extraction**: Use Google Gemini 2.0 Flash to extract structured invoice data
- **Vector Database**: ChromaDB integration for semantic search and document storage
- **RAG Query System**: Ask natural language questions about your documents
- **Invoice Management**: Approve, store, and export invoice data as CSV/Excel
- **Batch Processing**: Handle multiple documents simultaneously
- **REST API**: Complete FastAPI backend with automatic documentation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   FastAPI       │    │   ChromaDB      │
│   (Upload UI)   │───▶│   Backend       │───▶│   Vector DB     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │   OCR Service   │    │   Gemini AI     │
                    │   (Tesseract)   │    │   (Structured   │
                    │                 │    │    Extraction)  │
                    └─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Python 3.10+
- Tesseract OCR installed
- Google Gemini API key
- 8GB RAM recommended

### Install Tesseract OCR

**Windows:**
```bash
# Download and install from: https://github.com/UB-Mannheim/tesseract/wiki
# Or use chocolatey:
choco install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install tesseract-ocr tesseract-ocr-eng
```

**macOS:**
```bash
brew install tesseract
```

## ⚡ Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd Finance_OCR
```

### 2. Create Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Environment Configuration

Create `.env` file:

```env
# Required: Get your Gemini API key from https://ai.google.dev/
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Customize these settings
CHROMADB_PATH=./chromadb_data
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_EXTENSIONS=png,jpg,jpeg,pdf
```

### 5. Run the Server

```bash
# Development
python app/main.py

# Or using uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Access the API

- **API Documentation**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 🔧 API Endpoints

### OCR Processing
- `POST /ocr/extract` - Extract text from uploaded document
- `POST /ocr/batch-extract` - Process multiple documents

### AI Data Extraction
- `POST /ai/extract` - Extract structured invoice data using AI
- `POST /ai/extract-with-context` - Extract with custom context
- `GET /ai/document/{doc_id}/preview` - Preview document text
- `POST /ai/reprocess/{doc_id}` - Reprocess with improved extraction

### Invoice Management
- `POST /invoices/approve` - Approve and store invoice
- `GET /invoices/` - List approved invoices (paginated)
- `GET /invoices/{invoice_id}` - Get specific invoice
- `GET /invoices/export/csv` - Export invoices as CSV
- `GET /invoices/export/excel` - Export invoices as Excel
- `GET /invoices/stats/summary` - Get invoice statistics

### RAG Query System
- `POST /query/` - Ask questions about documents using RAG
- `POST /query/similar-documents` - Find similar documents
- `GET /query/suggestions` - Get suggested queries
- `POST /query/explain` - Explain query processing

## 📝 Usage Examples

### 1. Upload and Process Document

```python
import requests

# Upload document for OCR
with open('invoice.png', 'rb') as f:
    response = requests.post(
        'http://localhost:8000/ocr/extract',
        files={'file': f}
    )
    doc_data = response.json()
    print(f"Document ID: {doc_data['doc_id']}")
```

### 2. Extract Structured Data

```python
# Extract invoice data using AI
response = requests.post(
    'http://localhost:8000/ai/extract',
    json={'doc_id': doc_data['doc_id']}
)
invoice_data = response.json()
print(f"Vendor: {invoice_data['extracted_data']['vendor']}")
```

### 3. Approve Invoice

```python
# Approve and store invoice
approve_data = {
    "doc_id": doc_data['doc_id'],
    "vendor": "ABC Company",
    "invoice_number": "INV-2025-001",
    "date": "2025-01-08",
    "line_items": [
        {
            "description": "Office Supplies",
            "quantity": 10,
            "unit_price": 15.50,
            "total": 155.00
        }
    ],
    "subtotal": 155.00,
    "tax": 15.50,
    "total": 170.50
}

response = requests.post(
    'http://localhost:8000/invoices/approve',
    json=approve_data
)
print(f"Invoice ID: {response.json()['invoice_id']}")
```

### 4. Query Documents

```python
# Ask questions using RAG
response = requests.post(
    'http://localhost:8000/query/',
    json={
        "query": "What is the total amount of all invoices from ABC Company?",
        "context_type": "all"
    }
)
print(response.json()['answer'])
```

## 🗂️ Project Structure

```
Finance_OCR/
├── app/
│   ├── config/
│   │   └── settings.py          # Environment configuration
│   ├── db/
│   │   └── chromadb_client.py   # ChromaDB client setup
│   ├── models/
│   │   └── schemas.py           # Pydantic models
│   ├── routers/
│   │   ├── ocr.py              # OCR endpoints
│   │   ├── ai.py               # AI extraction endpoints
│   │   ├── invoices.py         # Invoice management
│   │   └── query.py            # RAG query endpoints
│   ├── services/
│   │   ├── ocr_service.py      # OCR processing logic
│   │   ├── ai_service.py       # Gemini AI integration
│   │   └── db_service.py       # Database operations
│   └── main.py                 # FastAPI application
├── uploads/                    # Uploaded files storage
├── chromadb_data/             # ChromaDB persistence
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

## 🔍 Database Schema

### Documents Collection
```json
{
  "id": "doc_001",
  "file_name": "invoice.png",
  "file_type": "image/png",
  "upload_date": "2025-01-08T10:00:00Z",
  "raw_text": "Invoice text...",
  "cleaned_text": "Cleaned text...",
  "metadata": {
    "document_type": "invoice",
    "confidence_score": 0.87
  }
}
```

### Invoices Collection
```json
{
  "id": "inv_2025_001",
  "vendor": "ABC Company",
  "invoice_number": "INV-001",
  "date": "2025-01-08",
  "line_items": [...],
  "subtotal": 155.00,
  "tax": 15.50,
  "total": 170.50,
  "metadata": {
    "status": "approved",
    "source_doc_id": "doc_001"
  }
}
```

## 🚀 Production Deployment

### Using Docker

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Using Gunicorn

```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required) | - |
| `CHROMADB_PATH` | ChromaDB storage path | `./chromadb_data` |
| `UPLOAD_DIR` | File upload directory | `./uploads` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |
| `ALLOWED_EXTENSIONS` | Allowed file extensions | `png,jpg,jpeg,pdf` |

### OCR Configuration

- Supports multiple languages (configure in `settings.py`)
- Preprocessing: grayscale, denoise, deskew, contrast enhancement
- Confidence scoring for extracted text

### AI Model Settings

- Model: Gemini 2.0 Flash (configurable)
- Temperature: 0.1 (low for consistent extraction)
- Max tokens: 8192
- RAG context window: 5 documents

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/ -v

# With coverage
pytest --cov=app tests/
```

## 📊 Performance Considerations

- **File Size**: Limit uploads to 10MB for optimal performance
- **Batch Processing**: Process max 10 files per batch request
- **Database**: ChromaDB handles up to 100K documents efficiently
- **Concurrency**: FastAPI supports async processing for better throughput
- **Memory**: OCR processing requires ~2GB RAM per concurrent request

## 🔐 Security Notes

- No authentication implemented (add for production)
- File validation prevents malicious uploads
- Environment variables for sensitive data
- CORS configured (restrict origins in production)
- No sensitive data logging

## 🐛 Troubleshooting

### Common Issues

1. **Tesseract not found**
   ```bash
   # Add tesseract to PATH or install properly
   ```

2. **ChromaDB permissions**
   ```bash
   # Ensure write permissions to chromadb_data directory
   chmod 755 chromadb_data
   ```

3. **Gemini API errors**
   ```bash
   # Verify API key and quota limits
   # Check https://ai.google.dev/pricing
   ```

4. **Memory issues**
   ```bash
   # Reduce batch size or increase system RAM
   ```

## 📈 Future Enhancements

- [ ] Authentication & authorization
- [ ] Real-time processing with WebSockets
- [ ] Multiple file format support (Word, Excel)
- [ ] Custom AI model fine-tuning
- [ ] Advanced analytics dashboard
- [ ] Multi-language OCR support
- [ ] Workflow automation
- [ ] Integration APIs (QuickBooks, SAP)

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the [API documentation](http://localhost:8000/docs)
- Review the troubleshooting section above

---

**Built with ❤️ using FastAPI, ChromaDB, and Google Gemini AI**