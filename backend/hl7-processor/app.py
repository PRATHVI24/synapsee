from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import hl7apy
from hl7apy.parser import parse_message
import fitz  # PyMuPDF
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
import easyocr
from paddleocr import PaddleOCR
import cv2
import numpy as np
from PIL import Image
import io
import re
from typing import Dict, Any, List
import base64
from datetime import datetime
import json

app = FastAPI(title="Simple HL7 Processor")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="templates")

# Initialize OCR engines
easyocr_reader = easyocr.Reader(['en'])
paddle_ocr = PaddleOCR(use_textline_orientation=True, lang='en')

# ================== HL7 TO NATURAL LANGUAGE ==================

def clean_hl7_message(message: str) -> str:
    """Clean and format HL7 message for parsing"""
    # Remove any leading/trailing whitespace
    message = message.strip()
    
    # Replace various line ending formats with proper \r
    message = message.replace('\r\n', '\r')
    message = message.replace('\n', '\r')
    
    # Remove any double \r that might have been created
    message = re.sub(r'\r+', '\r', message)
    
    # Ensure no trailing \r at the end
    message = message.rstrip('\r')
    
    # Fix any issues with the MSH segment (should be first)
    lines = message.split('\r')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        if line:  # Skip empty lines
            # Fix common issues with segments
            if line.startswith('MSH'):
                # Ensure MSH has proper field separators
                if '|' in line:
                    parts = line.split('|')
                    # Fix version field if needed (should be at position 11)
                    if len(parts) > 11 and parts[11] in ['P', 'D', 'T']:
                        # Common processing IDs are P (Production), D (Debugging), T (Training)
                        # But version should be before this (position 11 is processing ID)
                        pass
            cleaned_lines.append(line)
    
    return '\r'.join(cleaned_lines)

def parse_hl7_to_text(hl7_message: str) -> Dict[str, Any]:
    """Parse HL7 message to human-readable format"""
    try:
        # Clean the message first
        hl7_message = clean_hl7_message(hl7_message)
        
        # Manual parsing approach for better compatibility
        lines = hl7_message.split('\r')
        segments = {}
        
        # Parse each segment
        for line in lines:
            if not line.strip():
                continue
            
            parts = line.split('|')
            if not parts:
                continue
                
            segment_type = parts[0]
            
            # Store segments by type (handle multiple of same type)
            if segment_type not in segments:
                segments[segment_type] = []
            segments[segment_type].append(parts)
        
        result = {
            "summary": "",
            "details": {}
        }
        
        # Extract patient info from PID segment
        if 'PID' in segments and segments['PID']:
            pid = segments['PID'][0]  # First PID segment
            patient_info = []
            
            # Patient Name (field 5)
            if len(pid) > 5 and pid[5]:
                name_parts = pid[5].split('^')
                first_name = name_parts[1] if len(name_parts) > 1 else ""
                last_name = name_parts[0] if name_parts else ""
                name = f"{first_name} {last_name}".strip()
                if name:
                    patient_info.append(f"Patient: {name}")
            
            # Patient ID (field 3)
            if len(pid) > 3 and pid[3]:
                patient_info.append(f"Patient ID: {pid[3]}")
            
            # Date of Birth (field 7)
            if len(pid) > 7 and pid[7]:
                dob = pid[7]
                if len(dob) >= 8:
                    formatted_dob = f"{dob[4:6]}/{dob[6:8]}/{dob[0:4]}"
                    patient_info.append(f"DOB: {formatted_dob}")
            
            # Gender (field 8)
            if len(pid) > 8 and pid[8]:
                gender = "Male" if pid[8] == "M" else "Female" if pid[8] == "F" else pid[8]
                patient_info.append(f"Gender: {gender}")
            
            # Address (field 11)
            if len(pid) > 11 and pid[11]:
                addr_parts = pid[11].split('^')
                address_components = []
                if len(addr_parts) > 0 and addr_parts[0]:
                    address_components.append(addr_parts[0])
                if len(addr_parts) > 2 and addr_parts[2]:  # City
                    address_components.append(addr_parts[2])
                if len(addr_parts) > 3 and addr_parts[3]:  # State
                    address_components.append(addr_parts[3])
                if len(addr_parts) > 4 and addr_parts[4]:  # Zip
                    address_components.append(addr_parts[4])
                if address_components:
                    patient_info.append(f"Address: {', '.join(address_components)}")
            
            # Phone (field 13)
            if len(pid) > 13 and pid[13]:
                phone = pid[13].replace('^', '').replace('~', ', ')
                if phone:
                    patient_info.append(f"Phone: {phone}")
            
            if patient_info:
                result["details"]["patient"] = "\n".join(patient_info)
        
        # Extract visit info from PV1 segment
        if 'PV1' in segments and segments['PV1']:
            pv1 = segments['PV1'][0]
            visit_info = []
            
            # Patient Class (field 2)
            if len(pv1) > 2 and pv1[2]:
                patient_class = pv1[2]
                class_desc = {"I": "Inpatient", "O": "Outpatient", "E": "Emergency"}.get(patient_class, patient_class)
                visit_info.append(f"Patient Class: {class_desc}")
            
            # Location (field 3)
            if len(pv1) > 3 and pv1[3]:
                location = pv1[3].replace('^', ' ')
                visit_info.append(f"Location: {location}")
            
            # Attending Doctor (field 7)
            if len(pv1) > 7 and pv1[7]:
                doc_parts = pv1[7].split('^')
                if len(doc_parts) > 1:
                    visit_info.append(f"Attending Doctor: Dr. {doc_parts[1]} {doc_parts[0] if doc_parts[0] else ''}".strip())
            
            if visit_info:
                result["details"]["visit"] = "\n".join(visit_info)
        
        # Extract order info from ORC segment
        if 'ORC' in segments and segments['ORC']:
            orc = segments['ORC'][0]
            order_info = []
            
            # Order Control (field 1)
            if len(orc) > 1 and orc[1]:
                order_info.append(f"Order Control: {orc[1]}")
            
            # Ordering Provider (field 12)
            if len(orc) > 12 and orc[12]:
                provider_parts = orc[12].split('^')
                if len(provider_parts) > 1:
                    order_info.append(f"Ordering Provider: Dr. {provider_parts[1]} {provider_parts[0] if provider_parts[0] else ''}".strip())
            
            if order_info:
                result["details"]["orders"] = "\n".join(order_info)
        
        # Extract test orders from OBR segments
        if 'OBR' in segments:
            test_orders = []
            for obr in segments['OBR']:
                # Test name (field 4)
                if len(obr) > 4 and obr[4]:
                    test_parts = obr[4].split('^')
                    test_name = test_parts[1] if len(test_parts) > 1 else test_parts[0]
                    test_code = test_parts[0] if test_parts else ""
                    
                    test_text = f"• {test_name}"
                    if test_code and test_code != test_name:
                        test_text += f" (Code: {test_code})"
                    
                    test_orders.append(test_text)
            
            if test_orders:
                result["details"]["tests_ordered"] = "Tests Ordered:\n" + "\n".join(test_orders)
        
        # Extract lab results from OBX segments
        if 'OBX' in segments:
            lab_results = []
            for obx in segments['OBX']:
                try:
                    result_text = ""
                    
                    # Test name (field 3)
                    if len(obx) > 3 and obx[3]:
                        test_parts = obx[3].split('^')
                        test_name = test_parts[1] if len(test_parts) > 1 else test_parts[0]
                        result_text = f"• {test_name}: "
                    
                    # Value (field 5)
                    if len(obx) > 5 and obx[5]:
                        result_text += obx[5]
                    
                    # Units (field 6)
                    if len(obx) > 6 and obx[6]:
                        result_text += f" {obx[6]}"
                    
                    # Abnormal flag (field 8)
                    if len(obx) > 8 and obx[8]:
                        flag = obx[8]
                        if flag == "H":
                            result_text += " [HIGH]"
                        elif flag == "L":
                            result_text += " [LOW]"
                    
                    if result_text and result_text != "• : ":
                        lab_results.append(result_text)
                except:
                    continue
            
            if lab_results:
                result["details"]["lab_results"] = "Lab Results:\n" + "\n".join(lab_results)
        
        # Extract diagnoses from DG1 segments
        if 'DG1' in segments:
            diagnoses = []
            for dg1 in segments['DG1']:
                # Diagnosis (field 3)
                if len(dg1) > 3 and dg1[3]:
                    diag_parts = dg1[3].split('^')
                    if len(diag_parts) > 1:
                        diagnoses.append(f"• {diag_parts[1]} (Code: {diag_parts[0]})")
                    elif diag_parts:
                        diagnoses.append(f"• {diag_parts[0]}")
            
            if diagnoses:
                result["details"]["diagnoses"] = "Diagnoses:\n" + "\n".join(diagnoses)
        
        # Extract insurance info from IN1 segment
        if 'IN1' in segments and segments['IN1']:
            in1 = segments['IN1'][0]
            insurance_info = []
            
            # Insurance Company (field 3)
            if len(in1) > 3 and in1[3]:
                insurance_info.append(f"Insurance Company: {in1[3]}")
            
            # Insurance Address (field 4)
            if len(in1) > 4 and in1[4]:
                addr_parts = in1[4].split('^')
                if addr_parts[0]:
                    insurance_info.append(f"Insurance Address: {addr_parts[0]}")
            
            # Insured Name (field 7)
            if len(in1) > 7 and in1[7]:
                name_parts = in1[7].split('^')
                if name_parts:
                    name = f"{name_parts[1] if len(name_parts) > 1 else ''} {name_parts[0]}".strip()
                    insurance_info.append(f"Insured Name: {name}")
            
            if insurance_info:
                result["details"]["insurance"] = "\n".join(insurance_info)
        
        # Extract guarantor info from GT1 segment
        if 'GT1' in segments and segments['GT1']:
            gt1 = segments['GT1'][0]
            guarantor_info = []
            
            # Guarantor Name (field 3)
            if len(gt1) > 3 and gt1[3]:
                name_parts = gt1[3].split('^')
                if name_parts:
                    name = f"{name_parts[1] if len(name_parts) > 1 else ''} {name_parts[0]}".strip()
                    guarantor_info.append(f"Guarantor: {name}")
            
            # Address (field 5)
            if len(gt1) > 5 and gt1[5]:
                addr_parts = gt1[5].split('^')
                if addr_parts[0]:
                    guarantor_info.append(f"Address: {addr_parts[0]}")
            
            if guarantor_info:
                result["details"]["guarantor"] = "\n".join(guarantor_info)
        
        # Create summary
        summary_parts = []
        for key, value in result["details"].items():
            summary_parts.append(value)
        
        result["summary"] = "\n\n".join(summary_parts) if summary_parts else "No data extracted from HL7 message"
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing HL7: {str(e)}")

# ================== PDF TO HL7 CONVERSION ==================

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF"""
    try:
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            text += page.get_text()
        pdf_document.close()
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading PDF: {str(e)}")

def extract_lab_order_data_improved(text: str) -> Dict[str, str]:
    """Enhanced extraction of structured data from lab order text"""
    data = {
        "patient_name": "",
        "patient_id": "",
        "dob": "",
        "gender": "",
        "ordering_physician": "",
        "tests": [],
        "diagnosis": "",
        "order_date": ""
    }
    
    # Clean the text first
    text = ' '.join(text.split())  # Normalize whitespace
    
    # Debug: Print text to see what we're working with
    print(f"Processing text (first 500 chars): {text[:500]}")
    
    # More flexible regex patterns
    patterns = {
        # Match "Patient Information John Smith" or "Patient Name: John Smith"
        "patient_name": [
            r"Patient\s+Information\s+([A-Za-z]+\s+[A-Za-z]+)",
            r"Patient\s+Name[:\s]+([A-Za-z]+\s+[A-Za-z]+)",
            r"Name[:\s]+([A-Za-z]+\s+[A-Za-z]+)"
        ],
        
        # Match various ID formats
        "patient_id": [
            r"Patient\s+ID\s*/\s*MM[N]?[:\s]*(\d+)",
            r"(?:Patient\s+ID|MRN|ID)[:\s/]+(\d+)",
            r"MM[N]?[:\s]*(\d+)"
        ],
        
        # Match date formats
        "dob": [
            r"(?:DOB|Date\s+of\s+Birth)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
            r"Birth[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
        ],
        
        # Match gender
        "gender": [
            r"Gender[:\s]+([MFmf])\b",
            r"Sex[:\s]+([MFmf])\b"
        ],
        
        # Match physician name
        "ordering_physician": [
            r"Ordering\s+Physician[:\s]+(?:Dr\.?\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)",
            r"Physician[:\s]+(?:Dr\.?\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)",
            r"Signature\s+of\s+Ordering\s+Physician"
        ],
        
        # Match order date
        "order_date": [
            r"Order\s+Details[:\s]+(\d{1,2}/\d{1,2}/\d{4})",
            r"Date[:\s]+(\d{1,2}/\d{1,2}/\d{4})",
            r"(\d{2}/\d{2}/\d{4})"  # Any date format
        ]
    }
    
    # Try multiple patterns for each field
    for field, pattern_list in patterns.items():
        if not isinstance(pattern_list, list):
            pattern_list = [pattern_list]
        
        for pattern in pattern_list:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if match.groups():
                    value = match.group(1).strip()
                    if field == "patient_name":
                        # Clean up name
                        value = ' '.join(value.split())
                    data[field] = value
                else:
                    # For patterns without capture groups (like Signature of Ordering Physician)
                    if field == "ordering_physician":
                        data[field] = "Ordering Physician"
                break
    
    # CRITICAL FIX: More aggressive test extraction
    # Strategy 1: Look for tests anywhere in the text
    test_mappings = [
        (r"CBC\s*\(?Complete\s+Blood\s+Count\)?", "CBC"),
        (r"BMP\s*\(?Basic\s+(?:Blood|Metabolic)\s+(?:Count|Panel)\)?", "BMP"),
        (r"CMP\s*\(?Comprehensive\s+Metabolic\s+Panel\)?", "CMP"),
        (r"TSH\s*\(?Thyroid\s+Stimulating\s+Hormone\)?", "TSH"),
        (r"Lipid\s+[Pp]anel", "Lipid Panel"),
        (r"HbA1c|Hemoglobin\s+A1c", "HbA1c"),
        (r"Urinalysis|UA", "Urinalysis"),
        (r"Glucose", "Glucose"),
    ]
    
    # Search for each test in the entire text
    for pattern, test_name in test_mappings:
        if re.search(pattern, text, re.IGNORECASE):
            if test_name not in data["tests"]:
                data["tests"].append(test_name)
                print(f"Found test: {test_name}")
    
    # Strategy 2: Also look for test abbreviations alone
    test_abbreviations = {
        r"\bCBC\b": "CBC",
        r"\bBMP\b": "BMP",
        r"\bCMP\b": "CMP",
        r"\bTSH\b": "TSH",
    }
    
    for pattern, test_name in test_abbreviations.items():
        if re.search(pattern, text, re.IGNORECASE):
            if test_name not in data["tests"]:
                data["tests"].append(test_name)
                print(f"Found test abbreviation: {test_name}")
    
    # Extract diagnosis
    diagnosis_patterns = [
        r"Diagnosis[/\s]*Clinical\s+Information[:\s]*([^\n]*(?:\n[^\n]*)*?)(?:Signature|$)",
        r"Diagnosis[:\s/]+([^\n]+(?:\n[^\n]+)*?)(?:Signature|$)",
        r"Clinical\s+Information[:\s]+([^\n]+)"
    ]
    
    for pattern in diagnosis_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            diagnosis_text = match.group(1).strip()
            
            # Extract specific conditions
            diagnoses = []
            if re.search(r"[Hh]ypertension", diagnosis_text):
                diagnoses.append("Hypertension")
            if re.search(r"[Tt]ype\s*2\s*[Dd][il]abetes", diagnosis_text):
                diagnoses.append("Type 2 Diabetes")
            elif re.search(r"[Dd]iabetes", diagnosis_text):
                diagnoses.append("Diabetes")
            
            data["diagnosis"] = ", ".join(diagnoses) if diagnoses else diagnosis_text
            break

    # Debug: Print extracted data
    print(f"Extracted data: {data}")
    
    return data


def create_hl7_orm_message_improved(lab_data: Dict[str, str]) -> str:
    """Create properly formatted HL7 ORM message from extracted data"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    message_id = datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]
    
    # Build MSH segment
    msh = f"MSH|^~\\&|LAB_SYSTEM|LAB_FACILITY|EMR|HOSPITAL|{timestamp}||ORM^O01|{message_id}|P|2.5|||AL"
    
    # Build PID segment with proper data
    if lab_data["patient_name"]:
        name_parts = lab_data["patient_name"].split()
        last_name = name_parts[-1] if len(name_parts) > 1 else name_parts[0] if name_parts else "UNKNOWN"
        first_name = ' '.join(name_parts[:-1]) if len(name_parts) > 1 else ""
    else:
        last_name = "UNKNOWN"
        first_name = ""
    
    # Format DOB properly
    dob = ""
    if lab_data.get("dob"):
        dob_raw = lab_data["dob"]
        # Try to parse and reformat the date
        dob_parts = re.split(r'[/-]', dob_raw)
        if len(dob_parts) == 3:
            month, day, year = dob_parts
            # Ensure 4-digit year
            if len(year) == 2:
                year = "20" + year if int(year) < 50 else "19" + year
            dob = f"{year}{month.zfill(2)}{day.zfill(2)}"
    
    # Get gender
    gender = lab_data.get("gender", "").upper() if lab_data.get("gender") else "U"
    
    # Build PID with actual data
    patient_id = lab_data.get("patient_id", "UNKNOWN")
    pid = f"PID|1||{patient_id}||{last_name}^{first_name}||{dob}|{gender}"
    
    # Build PV1 segment
    physician = lab_data.get("ordering_physician", "").replace(" ", "^") if lab_data.get("ordering_physician") else ""
    pv1 = f"PV1|1|O|^^^LAB||||{physician}"
    
    # Build ORC segment with order date if available
    order_date = ""
    if lab_data.get("order_date"):
        # Convert order date to HL7 format
        date_parts = re.split(r'[/-]', lab_data["order_date"])
        if len(date_parts) == 3:
            month, day, year = date_parts
            if len(year) == 4:
                order_date = f"{year}{month.zfill(2)}{day.zfill(2)}"
    
    orc_timestamp = order_date + "000000" if order_date else timestamp
    orc = f"ORC|NW|{message_id}|||CM||||{orc_timestamp}|||{physician}"
    
    segments = [msh, pid, pv1, orc]
    
    # Build OBR segments for each test
    if lab_data.get("tests"):
        for i, test in enumerate(lab_data["tests"], 1):
            # Map test names to standard codes
            test_codes = {
                "CBC": "85025^Complete Blood Count^L",
                "BMP": "80048^Basic Metabolic Panel^L",
                "CMP": "80053^Comprehensive Metabolic Panel^L",
                "TSH": "84443^Thyroid Stimulating Hormone^L",
                "Lipid Panel": "80061^Lipid Panel^L",
                "HbA1c": "83036^Hemoglobin A1c^L",
                "Urinalysis": "81003^Urinalysis^L",
                "Glucose": "82947^Glucose^L"
            }
            
            # Find matching code or use test name
            test_code = test_codes.get(test, f"^{test}^L")
            
            obr = f"OBR|{i}|{message_id}_{i}||{test_code}||{orc_timestamp}|||||||||{physician}||||||||F"
            segments.append(obr)
    
    # Add DG1 segment if diagnosis exists
    if lab_data.get("diagnosis"):
        # Map common diagnoses to ICD codes
        diagnosis_codes = {
            "Hypertension": "I10^Essential Hypertension^I10",
            "Type 2 Diabetes": "E11.9^Type 2 Diabetes Mellitus^I10",
            "Diabetes": "E11.9^Diabetes Mellitus^I10"
        }
        
        diagnoses = lab_data["diagnosis"].split(", ")
        for i, diagnosis in enumerate(diagnoses, 1):
            if diagnosis in diagnosis_codes:
                dg1 = f"DG1|{i}||{diagnosis_codes[diagnosis]}||{timestamp}"
            else:
                dg1 = f"DG1|{i}||^{diagnosis}^I10||{timestamp}"
            segments.append(dg1)
    
    return "\r".join(segments)

# ================== OCR PROCESSING ==================

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Preprocess image for better OCR accuracy"""
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Denoise
    denoised = cv2.medianBlur(thresh, 3)
    
    return denoised

def perform_multi_engine_ocr(image_bytes: bytes) -> Dict[str, Any]:
    """Perform OCR using multiple engines and combine results"""
    results = {
        "tesseract": "",
        "easyocr": "",
        "paddleocr": "",
        "combined": "",
        "confidence": 0
    }
    
    try:
        # Preprocess image
        processed_img = preprocess_image(image_bytes)
        
        # Tesseract OCR
        try:
            pil_image = Image.fromarray(processed_img)
            results["tesseract"] = pytesseract.image_to_string(pil_image)
        except Exception as e:
            results["tesseract"] = f"Error: {str(e)}"
        
        # EasyOCR
        try:
            result_easy = easyocr_reader.readtext(processed_img)
            results["easyocr"] = " ".join([text[1] for text in result_easy])
        except Exception as e:
            results["easyocr"] = f"Error: {str(e)}"
        
        # PaddleOCR
        try:
            result_paddle = paddle_ocr.predict(processed_img)
            if result_paddle and len(result_paddle) > 0 and result_paddle[0]:
                # Handle the result structure from predict() method
                paddle_texts = []
                for line in result_paddle[0]:
                    if len(line) >= 2 and len(line[1]) >= 1:
                        paddle_texts.append(line[1][0])
                results["paddleocr"] = " ".join(paddle_texts)
            else:
                results["paddleocr"] = "No text detected"
        except Exception as e:
            results["paddleocr"] = f"Error: {str(e)}"
        
        # Combine results (simple voting/consensus)
        all_text = []
        confidence_scores = []
        
        for engine in ["tesseract", "easyocr", "paddleocr"]:
            if results[engine] and not results[engine].startswith("Error"):
                all_text.append(results[engine])
                confidence_scores.append(len(results[engine]))
        
        if all_text:
            # Use the longest extracted text as combined result
            results["combined"] = max(all_text, key=len)
            results["confidence"] = min(95, 60 + (len(all_text) * 15))  # Simple confidence calculation
        
    except Exception as e:
        results["error"] = str(e)
    
    return results

def ocr_to_hl7(ocr_text: str) -> str:
    """Convert OCR extracted text to HL7 format"""
    # Extract data using the improved function
    lab_data = extract_lab_order_data_improved(ocr_text)
    
    # Debug: Print extracted data
    print(f"OCR Text (first 200 chars): {ocr_text[:200]}")
    print(f"Extracted data from OCR: {lab_data}")
    
    # Create HL7 message
    return create_hl7_orm_message_improved(lab_data)

# ================== API ENDPOINTS ==================

@app.get("/", response_class=HTMLResponse)
async def home():
    """Serve the HTML interface"""
    return templates.TemplateResponse("index.html", {"request": {}})

@app.post("/api/hl7-to-text")
async def hl7_to_text(message: str = Form(...)):
    """Convert HL7 message to natural language"""
    try:
        result = parse_hl7_to_text(message)
        return JSONResponse(content=result)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": str(e.detail)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Internal server error: {str(e)}"})

@app.post("/api/pdf-to-hl7")
async def pdf_to_hl7(file: UploadFile = File(...)):
    """Convert PDF lab order to HL7"""
    try:
        # Read PDF file
        pdf_bytes = await file.read()
        
        # Extract text from PDF
        pdf_text = extract_text_from_pdf(pdf_bytes)
        
        # Extract structured data
        lab_data = extract_lab_order_data_improved(pdf_text)
        
        # Debug logging
        print(f"PDF Text extraction complete")
        print(f"Extracted lab data: {lab_data}")
        
        # Create HL7 message
        hl7_message = create_hl7_orm_message_improved(lab_data)
        
        return JSONResponse(content={
            "extracted_data": lab_data,
            "hl7_message": hl7_message,
            "pdf_text": pdf_text[:500]  # First 500 chars for preview
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ocr-process")
async def ocr_process(file: UploadFile = File(...)):
    """Process image with OCR and convert to HL7"""
    try:
        # Read image file
        image_bytes = await file.read()
        
        # Perform multi-engine OCR
        ocr_results = perform_multi_engine_ocr(image_bytes)
        
        # Debug logging
        print(f"OCR Results confidence: {ocr_results.get('confidence', 0)}%")
        
        # Convert to HL7 if text was extracted
        hl7_message = ""
        extracted_data = {}
        if ocr_results["combined"]:
            # Extract data first for debugging
            extracted_data = extract_lab_order_data_improved(ocr_results["combined"])
            print(f"Data extracted from OCR: {extracted_data}")
            
            # Create HL7 message
            hl7_message = create_hl7_orm_message_improved(extracted_data)
        
        return JSONResponse(content={
            "ocr_results": ocr_results,
            "hl7_message": hl7_message,
            "extracted_data": extracted_data  # Include extracted data in response
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)