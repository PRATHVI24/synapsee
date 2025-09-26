from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Union
import os


class Settings(BaseSettings):
    gemini_api_key: str = Field(..., env="GEMINI_API_KEY")
    chromadb_path: str = Field(default="./chromadb_data", env="CHROMADB_PATH")
    upload_dir: str = Field(default="./uploads", env="UPLOAD_DIR")
    max_file_size: int = Field(default=10485760, env="MAX_FILE_SIZE")  # 10MB
    allowed_extensions: Union[List[str], str] = Field(default=["png", "jpg", "jpeg", "pdf"], env="ALLOWED_EXTENSIONS")

    @field_validator('allowed_extensions')
    @classmethod
    def parse_allowed_extensions(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(',')]
        return v

    # FastAPI settings
    title: str = "Finance Document Extractor API"
    version: str = "1.0.0"
    description: str = "AI-powered document processing system for financial documents"

    # OCR settings
    tesseract_config: str = "--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,()-$:/"

    # AI settings
    gemini_model: str = "gemini-2.0-flash-exp"
    max_tokens: int = 8192
    temperature: float = 0.1

    # ChromaDB settings
    documents_collection: str = "documents"
    invoices_collection: str = "invoices"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()