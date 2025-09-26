import logging
import asyncio
import uuid 
import json
import traceback
from datetime import datetime, UTC
from typing import List, Dict
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentFalseInterruptionEvent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.rtc import DataPacketKind
from livekit.plugins import silero, google, deepgram

# Configure enhanced logging
logger = logging.getLogger("interview-bot")
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add file logging for debugging
file_handler = logging.FileHandler('interview_debug.log')
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

# Load environment variables
load_dotenv(dotenv_path=".env")

# JSON file for storing responses
RESPONSE_FILE = "responses.json"

# Sample JD and Resume (replace with actual parsing logic or input)
SAMPLE_JD = {
    "role": "Senior Software Engineer - AI/ML",
    "company": "TechCorp Solutions",
    "department": "AI & Data Science",
    "location": "Bangalore, India / Remote",
    "skills": [
        "Python", "Machine Learning", "Deep Learning", "Generative AI", 
        "Retrieval Augmented Generation", "LangChain", "Vector Databases",
        "PyTorch", "TensorFlow", "FastAPI", "Docker", "Kubernetes",
        "AWS", "GCP", "SQL", "NoSQL", "Git", "CI/CD", "Microservices"
    ],
    "technical_requirements": [
        "5+ years of Python development experience",
        "3+ years working with ML/AI frameworks",
        "Experience with Large Language Models and prompt engineering",
        "Knowledge of vector databases (Pinecone, Chroma, Weaviate)",
        "Proficiency in cloud platforms (AWS/GCP/Azure)",
        "Experience with containerization and orchestration",
        "Strong understanding of software design patterns",
        "Experience with RESTful APIs and microservices architecture"
    ],
    "experience": "5+ years",
    "education": "Bachelor's or Master's in Computer Science, AI, or related field",
    "soft_skills": [
        "Strong problem-solving and analytical thinking",
        "Excellent communication and teamwork skills",
        "Ability to work in fast-paced, agile environments",
        "Mentoring and leadership capabilities",
        "Continuous learning mindset"
    ],
    "responsibilities": [
        "Design and develop AI-powered applications and systems",
        "Implement RAG systems and chatbots using modern frameworks",
        "Collaborate with cross-functional teams on ML model deployment",
        "Optimize system performance and scalability",
        "Mentor junior developers and contribute to technical decisions",
        "Stay updated with latest AI/ML trends and technologies"
    ],
    "nice_to_have": [
        "PhD in AI/ML or related field",
        "Publications in AI/ML conferences",
        "Open source contributions",
        "Experience with MLOps and model monitoring",
        "Knowledge of computer vision or NLP specializations"
    ]
}

SAMPLE_RESUME = {
    "name": "Prajwal Bangera",
    "email": "prajwal.bangera@email.com",
    "phone": "+91-9876543210",
    "location": "Bangalore, Karnataka, India",
    "linkedin": "linkedin.com/in/prajwalbangera",
    "github": "github.com/prajwalbangera",
    "summary": "Experienced AI/ML Engineer with 6+ years in developing intelligent systems, specializing in NLP, RAG implementations, and large-scale data processing. Passionate about building production-ready AI solutions.",
    "experience": [
        {
            "company": "DataTech Innovations",
            "role": "Senior AI Engineer",
            "duration": "Jan 2022 - Present (3 years)",
            "location": "Bangalore, India",
            "achievements": [
                "Led development of enterprise RAG system serving 10K+ daily users",
                "Implemented multi-modal chatbot using GPT-4 and custom fine-tuned models",
                "Reduced query response time by 60% through vector database optimization",
                "Mentored 5 junior engineers and established ML best practices"
            ],
            "technologies": ["Python", "LangChain", "OpenAI API", "Pinecone", "FastAPI", "Docker", "AWS"]
        },
        {
            "company": "CloudScale Systems",
            "role": "ML Engineer",
            "duration": "Jun 2019 - Dec 2021 (2.5 years)",
            "location": "Mumbai, India",
            "achievements": [
                "Built real-time recommendation engine processing 1M+ events daily",
                "Deployed ML models using MLflow and Kubernetes on GCP",
                "Developed automated data pipeline reducing processing time by 40%",
                "Collaborated with product team on A/B testing framework"
            ],
            "technologies": ["Python", "TensorFlow", "GCP", "Kubernetes", "Apache Kafka", "BigQuery"]
        },
        {
            "company": "StartupAI Solutions",
            "role": "Junior Software Engineer",
            "duration": "Aug 2018 - May 2019 (9 months)",
            "location": "Pune, India",
            "achievements": [
                "Developed REST APIs for mobile application backend",
                "Implemented user authentication and authorization systems",
                "Contributed to migration from monolith to microservices"
            ],
            "technologies": ["Python", "Django", "PostgreSQL", "Redis", "Docker"]
        }
    ],
    "education": [
        {
            "degree": "Master of Technology in Artificial Intelligence",
            "institution": "Indian Institute of Science (IISc), Bangalore",
            "year": "2016-2018",
            "grade": "CGPA: 8.7/10",
            "thesis": "Deep Learning Approaches for Natural Language Understanding"
        },
        {
            "degree": "Bachelor of Engineering in Computer Science",
            "institution": "Manipal Institute of Technology, Manipal",
            "year": "2012-2016", 
            "grade": "CGPA: 8.2/10"
        }
    ],
    "projects": [
        {
            "name": "Enterprise Document Q&A System",
            "duration": "2023-2024",
            "description": "End-to-end RAG system for internal document querying",
            "technologies": ["Python", "LangChain", "ChromaDB", "OpenAI", "Streamlit", "Docker"],
            "achievements": [
                "Processed 50K+ documents with 95% accuracy",
                "Implemented semantic search with re-ranking",
                "Deployed on AWS with auto-scaling capabilities",
                "Reduced document search time from hours to seconds"
            ]
        },
        {
            "name": "Real-time Data Processing Pipeline",
            "duration": "2021-2022",
            "description": "Scalable data pipeline for streaming analytics",
            "technologies": ["Python", "Apache Kafka", "Apache Spark", "GCP", "BigQuery"],
            "achievements": [
                "Processed 5TB+ data daily with <100ms latency",
                "Implemented fault-tolerant architecture with 99.9% uptime",
                "Built monitoring dashboard with real-time alerts"
            ]
        },
        {
            "name": "Computer Vision Quality Control System",
            "duration": "2020-2021",
            "description": "AI-powered defect detection for manufacturing",
            "technologies": ["Python", "OpenCV", "PyTorch", "FastAPI", "Docker"],
            "achievements": [
                "Achieved 98% defect detection accuracy",
                "Reduced manual inspection time by 80%",
                "Deployed edge computing solution with NVIDIA Jetson"
            ]
        },
        {
            "name": "Customer Sentiment Analysis Platform",
            "duration": "2019-2020",
            "description": "NLP pipeline for social media sentiment monitoring",
            "technologies": ["Python", "spaCy", "BERT", "Apache Airflow", "MongoDB"],
            "achievements": [
                "Analyzed 1M+ social media posts daily",
                "Built custom BERT model with 92% F1-score",
                "Integrated with client CRM systems via APIs"
            ]
        }
    ],
    "skills": {
        "programming": ["Python", "SQL", "JavaScript", "Bash", "Go"],
        "ml_frameworks": ["PyTorch", "TensorFlow", "Scikit-learn", "XGBoost", "Hugging Face"],
        "ai_tools": ["LangChain", "OpenAI API", "Anthropic Claude", "Cohere", "Prompt Engineering"],
        "databases": ["PostgreSQL", "MongoDB", "Redis", "Pinecone", "ChromaDB", "Weaviate"],
        "cloud": ["AWS (EC2, S3, Lambda, SageMaker)", "GCP (Compute, BigQuery, Vertex AI)", "Azure"],
        "devops": ["Docker", "Kubernetes", "CI/CD", "Git", "MLflow", "Apache Airflow"],
        "web": ["FastAPI", "Django", "React", "RESTful APIs", "GraphQL"]
    },
    "certifications": [
        "AWS Certified Machine Learning - Specialty (2023)",
        "Google Cloud Professional ML Engineer (2022)",
        "TensorFlow Developer Certificate (2021)"
    ],
    "publications": [
        "Efficient Retrieval-Augmented Generation for Enterprise Applications - ICML 2024 Workshop",
        "Scalable Vector Search in Production Systems - NeurIPS 2023 Workshop"
    ],
    "languages": ["English (Fluent)", "Hindi (Native)", "Kannada (Native)"],
    "interests": ["Open Source Contributions", "Technical Blogging", "AI Ethics", "Trekking"]
}

class InterviewConfig:
    """Configuration class for dynamic interview duration management."""
    
    def __init__(self, custom_duration: int = None):
        # Base configuration
        self.base_duration = 30  # minutes
        self.role_multipliers = {
            "junior": 0.7,
            "software engineer": 1.0,
            "senior": 1.3,
            "lead": 1.5,
            "principal": 1.7,
            "architect": 1.8,
            "manager": 1.4,
            "director": 1.6
        }
        self.skill_time_allocation = 2.5  # minutes per skill on average
        self.adaptive_extension_enabled = True
        self.max_extension_percent = 0.15  # Allow 15% extension
        self.absolute_min_duration = 15  # minimum 15 minutes
        self.absolute_max_duration = 75  # maximum 75 minutes
        
        # Override with custom duration if provided
        self.custom_duration = custom_duration
    
    def calculate_interview_duration(self, jd: Dict, resume: Dict) -> tuple[int, dict]:
        """
        Calculate optimal interview duration based on JD and resume.
        Returns: (duration_in_minutes, calculation_details)
        """
        if self.custom_duration:
            return self.custom_duration, {"type": "custom", "duration": self.custom_duration}
        
        # Start with base duration
        calculated_duration = self.base_duration
        details = {"base_duration": self.base_duration}
        
        # Apply role-based multiplier
        role = jd.get("role", "").lower()
        multiplier = 1.0
        for role_key, mult in self.role_multipliers.items():
            if role_key in role:
                multiplier = mult
                break
        
        calculated_duration *= multiplier
        details["role_multiplier"] = multiplier
        details["after_role_adjustment"] = calculated_duration
        
        # Adjust for number of skills
        skills = jd.get("skills", [])
        skill_adjustment = len(skills) * self.skill_time_allocation
        calculated_duration += skill_adjustment
        details["skills_count"] = len(skills)
        details["skill_time_added"] = skill_adjustment
        details["after_skill_adjustment"] = calculated_duration
        
        # Adjust for resume complexity (projects and experience)
        projects = resume.get("projects", [])
        experience = resume.get("experience", [])
        complexity_bonus = (len(projects) * 1.5) + (len(experience) * 2)
        calculated_duration += complexity_bonus
        details["complexity_bonus"] = complexity_bonus
        details["projects_count"] = len(projects)
        details["experience_count"] = len(experience)
        
        # Apply bounds
        calculated_duration = max(self.absolute_min_duration, 
                                min(self.absolute_max_duration, calculated_duration))
        
        details["final_duration"] = int(calculated_duration)
        details["max_allowed_with_extension"] = int(calculated_duration * (1 + self.max_extension_percent))
        
        return int(calculated_duration), details
    
    def can_extend_interview(self, current_duration_seconds: int, planned_duration_minutes: int) -> bool:
        """Check if interview can be extended based on adaptive rules."""
        if not self.adaptive_extension_enabled:
            return False
        
        planned_duration_seconds = planned_duration_minutes * 60
        max_allowed_seconds = planned_duration_seconds * (1 + self.max_extension_percent)
        
        return current_duration_seconds < max_allowed_seconds
    
    def get_remaining_time_minutes(self, start_time: datetime, planned_duration_minutes: int, 
                                  with_extension: bool = False) -> float:
        """Get remaining time in minutes."""
        elapsed_seconds = (datetime.now(UTC) - start_time).total_seconds()
        base_remaining = (planned_duration_minutes * 60) - elapsed_seconds
        
        if with_extension and self.adaptive_extension_enabled:
            max_duration = planned_duration_minutes * (1 + self.max_extension_percent) * 60
            base_remaining = max_duration - elapsed_seconds
        
        return base_remaining / 60

class InterviewBot:
    def __init__(self, jd: Dict, resume: Dict, config: InterviewConfig = None):
        self.jd = jd
        self.resume = resume
        self.session_id = str(uuid.uuid4())
        self.questions_asked: List[Dict] = []
        self.responses: List[Dict] = []
        self.start_time = datetime.now(UTC)
        
        # Initialize interview configuration
        self.config = config or InterviewConfig()
        self.planned_duration_minutes, self.duration_details = self.config.calculate_interview_duration(jd, resume)
        self.interview_duration = self.planned_duration_minutes * 60  # Convert to seconds for compatibility
        
        self.candidate_name = resume.get("name", "Candidate")
        self.topics_covered = []
        self.adaptive_extensions_used = 0
        self.max_adaptive_extensions = 2  # Limit extensions
        
        # Log the calculated duration
        logger.info(f"Interview duration calculated: {self.planned_duration_minutes} minutes")
        logger.info(f"Duration calculation details: {self.duration_details}")
    
    def get_remaining_time(self, with_extension: bool = False) -> float:
        """Get remaining interview time in minutes."""
        return self.config.get_remaining_time_minutes(
            self.start_time, self.planned_duration_minutes, with_extension
        )
    
    def should_extend_interview(self, candidate_response_quality: str = "normal") -> bool:
        """Determine if interview should be extended based on adaptive rules."""
        if self.adaptive_extensions_used >= self.max_adaptive_extensions:
            return False
        
        current_duration = (datetime.now(UTC) - self.start_time).total_seconds()
        can_extend = self.config.can_extend_interview(current_duration, self.planned_duration_minutes)
        
        # Additional logic for when to extend
        if can_extend and candidate_response_quality in ["detailed", "excellent"]:
            remaining_topics = len([s for s in self.jd.get("skills", []) if s not in self.topics_covered])
            if remaining_topics > 2:  # More topics to cover
                return True
        
        return False
    
    def mark_topic_covered(self, topic: str):
        """Mark a topic as covered during the interview."""
        if topic not in self.topics_covered:
            self.topics_covered.append(topic)
    
    def get_interview_progress(self) -> dict:
        """Get current interview progress statistics."""
        elapsed_minutes = (datetime.now(UTC) - self.start_time).total_seconds() / 60
        progress_percent = min(100, (elapsed_minutes / self.planned_duration_minutes) * 100)
        
        return {
            "elapsed_minutes": round(elapsed_minutes, 1),
            "planned_duration": self.planned_duration_minutes,
            "remaining_minutes": round(self.get_remaining_time(), 1),
            "progress_percent": round(progress_percent, 1),
            "topics_covered": len(self.topics_covered),
            "total_skills": len(self.jd.get("skills", [])),
            "extensions_used": self.adaptive_extensions_used,
            "can_extend": self.config.can_extend_interview(
                (datetime.now(UTC) - self.start_time).total_seconds(), 
                self.planned_duration_minutes
            )
        }

    async def generate_question(self, session: AgentSession, topic: str, context: str = "", retry_count: int = 0) -> str:
        """Generate a question using session.llm with enhanced error handling and retries."""
        max_retries = 3
        logger.debug(f"Generating question for topic: {topic}, attempt {retry_count + 1}")
        
        try:
            with open("system_prompt.txt", "r") as f:
                system_prompt = f.read()
        except FileNotFoundError:
            logger.warning("system_prompt.txt not found, using default prompt")
            system_prompt = "You are a professional AI interview bot conducting technical interviews."
        
        # Build context from recent responses
        recent_context = ""
        if self.responses:
            recent_context = "Recent conversation:\n"
            for qa in self.responses[-2:]:  # Last 2 Q&As for context
                recent_context += f"Q: {qa['question']}\nA: {qa['response']}\n"
        
        # Get current interview progress for time-aware questioning
        progress = self.get_interview_progress()
        time_context = f"Interview progress: {progress['progress_percent']}% complete, {progress['remaining_minutes']} minutes remaining."
        
        prompt = (
            f"{system_prompt}\n\n"
            f"Current JD: {self.jd}\n"
            f"Resume: {self.resume}\n"
            f"Candidate name: {self.candidate_name}\n"
            f"Interview duration: {self.planned_duration_minutes} minutes\n"
            f"{time_context}\n\n"
            f"{recent_context}\n"
            f"Current topic focus: {topic}\n"
            f"Additional context: {context}\n"
            f"Topics already covered: {', '.join(self.topics_covered)}\n\n"
            f"Generate the next interview question focusing on {topic}. "
            f"Make it progressive, adaptive, and contextually relevant to previous responses. "
            f"Consider the remaining time and adjust depth accordingly. "
            f"Keep it conversational and natural. Only return the question, no additional text."
        )
        
        logger.info(f"Generating question for topic: {topic} (attempt {retry_count + 1})")
        try:
            # Create chat context with better error handling
            chat_ctx = session.llm.chat()
            chat_ctx.append(role="user", text=prompt)
            
            logger.debug(f"LLM chat context created successfully")
            
            # Generate response with timeout
            llm_stream = session.llm.generate(chat_ctx)
            
            response = ""
            async with asyncio.timeout(30):  # 30 second timeout for LLM response
                async for chunk in llm_stream:
                    if chunk.choices and len(chunk.choices) > 0 and chunk.choices[0].delta.content:
                        response += chunk.choices[0].delta.content
            
            question = response.strip() if response else None
            
            if question and len(question) > 10:  # Valid question generated
                logger.info(f"Generated question: {question}")
                return question
            else:
                raise ValueError("Generated question is empty or too short")
                
        except Exception as e:
            logger.error(f"Error generating question (attempt {retry_count + 1}): {e}")
            logger.debug(f"Full error traceback: {traceback.format_exc()}")
            
            # Retry logic
            if retry_count < max_retries:
                logger.info(f"Retrying question generation for topic: {topic}")
                await asyncio.sleep(2 ** retry_count)  # Exponential backoff
                return await self.generate_question(session, topic, context, retry_count + 1)
            else:
                # Fallback to predefined questions
                fallback_questions = {
                    "Python": "Can you walk me through a challenging Python project you've worked on?",
                    "Machine Learning": "Tell me about a machine learning model you've built and deployed.",
                    "Deep Learning": "What's your experience with deep learning frameworks like PyTorch or TensorFlow?",
                    "Generative AI": "How have you worked with Large Language Models or generative AI?",
                    "default": f"Can you describe your experience with {topic} and any specific challenges you've faced?"
                }
                
                fallback_question = fallback_questions.get(topic, fallback_questions["default"])
                logger.warning(f"Using fallback question for topic {topic}: {fallback_question}")
                return fallback_question

    async def store_response(self, question: str, response: str):
        """Store candidate response in a local JSON file."""
        if "my name is" in response.lower() and "name" not in question.lower():
            self.candidate_name = response.split("my name is", 1)[1].strip().split()[0]  # Update name if introduced
            logger.info(f"Updated candidate name to: {self.candidate_name}")  # Debug: Log name update
        response_entry = {
            "session_id": self.session_id,
            "question": question,
            "response": response,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        try:
            try:
                with open(RESPONSE_FILE, "r") as f:
                    data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                data = []
            data.append(response_entry)
            with open(RESPONSE_FILE, "w") as f:
                json.dump(data, f, indent=4)
            logger.info(f"Stored response: {response_entry}")  # Debug: Log stored response
        except Exception as e:
            logger.error(f"Failed to store response: {e}")

async def speak_text(session: AgentSession, text: str, retry_count: int = 0):
    """Enhanced TTS function with retry logic and comprehensive error handling."""
    max_retries = 2
    logger.debug(f"Speaking text (attempt {retry_count + 1}): {text[:50]}...")
    
    try:
        # Validate session TTS
        if not session or not session.tts:
            raise ValueError("Invalid session or TTS not available")
            
        # Sanitize text for SSML
        sanitized_text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Wrap text in <speak> tags for SSML processing
        ssml_text = f"<speak>{sanitized_text}</speak>"
        
        logger.debug(f"Creating TTS stream...")
        tts_stream = session.tts.stream()
        
        logger.debug(f"Pushing text to TTS stream")
        tts_stream.push_text(ssml_text)
        tts_stream.flush()
        logger.info(f"TTS stream pushed SSML text: {ssml_text}")
        
        # Wait for speech to complete with better timing estimation
        estimated_duration = max(3, len(text) / 12)  # Increased minimum time and slower rate
        logger.debug(f"Waiting {estimated_duration:.1f}s for TTS completion")
        await asyncio.sleep(estimated_duration)
        
        logger.debug(f"Closing TTS stream")
        await tts_stream.aclose()
        logger.info(f"TTS stream closed successfully for: {text}")
        
    except Exception as e:
        logger.error(f"Error in TTS stream (attempt {retry_count + 1}): {e}")
        logger.debug(f"TTS error traceback: {traceback.format_exc()}")
        
        if retry_count < max_retries:
            logger.info(f"Retrying TTS after error")
            await asyncio.sleep(1)
            return await speak_text(session, text, retry_count + 1)
        else:
            logger.warning(f"Attempting fallback TTS without SSML")
            try:
                tts_stream = session.tts.stream()
                tts_stream.push_text(text)  # No SSML
                tts_stream.flush()
                await asyncio.sleep(max(2, len(text) / 15))
                await tts_stream.aclose()
                logger.info(f"Fallback TTS completed for: {text}")
            except Exception as fallback_error:
                logger.error(f"Fallback TTS also failed: {fallback_error}")
                logger.debug(f"Fallback TTS error traceback: {traceback.format_exc()}")
                # Don't raise - continue with interview even if TTS fails
                logger.warning(f"Continuing without TTS for this message: {text}")

async def get_transcription(session: AgentSession, timeout: float = 30, retry_count: int = 0) -> str | None:
    """Enhanced transcription function with retry logic and better error handling."""
    max_retries = 3
    logger.debug(f"Starting transcription capture (timeout={timeout}s, attempt={retry_count + 1})")
    
    try:
        # Create STT stream with enhanced error handling
        logger.debug("Creating STT stream...")
        async with session.stt.stream() as stt_stream:
            logger.debug("STT stream created successfully")
            
            try:
                # Use timeout with better error handling
                async with asyncio.timeout(timeout):
                    transcription_attempts = 0
                    async for transcription in stt_stream:
                        transcription_attempts += 1
                        logger.debug(f"Received transcription attempt {transcription_attempts}: is_final={transcription.is_final}, alternatives={len(transcription.alternatives) if transcription.alternatives else 0}")
                        
                        if transcription.is_final and transcription.alternatives:
                            text = transcription.alternatives[0].text.strip()
                            if text and len(text) > 2:  # Minimum length check
                                logger.info(f"Valid transcription received: {text}")
                                return text
                            elif text:
                                logger.debug(f"Short transcription ignored: '{text}'")
                    
                    logger.debug(f"STT stream ended without final transcription (processed {transcription_attempts} attempts)")
                    return None
                    
            except asyncio.TimeoutError:
                logger.info(f"Timeout reached after {timeout}s, no transcription received")
                return None
                
    except Exception as e:
        logger.error(f"Error in transcription (attempt {retry_count + 1}): {e}")
        logger.debug(f"Full transcription error: {traceback.format_exc()}")
        
        # Retry with exponential backoff for transient errors
        if retry_count < max_retries and "audio" in str(e).lower():
            wait_time = 2 ** retry_count
            logger.info(f"Retrying transcription after {wait_time}s...")
            await asyncio.sleep(wait_time)
            return await get_transcription(session, timeout, retry_count + 1)
        
        return None

async def entrypoint(ctx: JobContext):
    logger.info("=== INTERVIEW BOT STARTING ===")
    logger.debug(f"Job context: {ctx}")
    
    try:
        # Initialize interview configuration
        # You can customize duration here: InterviewConfig(custom_duration=40) for 40 minutes
        interview_config = InterviewConfig()  # Uses dynamic calculation
        logger.debug("Interview config created successfully")
        
        bot = InterviewBot(jd=SAMPLE_JD, resume=SAMPLE_RESUME, config=interview_config)
        logger.debug(f"Interview bot initialized for {bot.candidate_name}")

        # Enhanced session creation with error handling
        logger.info("Creating agent session with components...")
        try:
            vad = silero.VAD.load()
            logger.debug("VAD loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load VAD: {e}")
            raise
            
        try:
            llm = google.LLM(model="gemini-2.0-flash")
            logger.debug("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            raise
            
        try:
            stt = deepgram.STT(
                model="nova-3",
                language="en-US",
                smart_format=True,
            )
            logger.debug("STT initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize STT: {e}")
            raise
            
        try:
            tts = google.TTS(
                language="en-US",
                gender="male",
                voice_name="en-US-Chirp3-HD-Despina",
            )
            logger.debug("TTS initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize TTS: {e}")
            raise

        session = AgentSession(
            vad=vad,
            llm=llm,
            stt=stt,
            tts=tts,
            agent_false_interruption_timeout=5.0,  # Increased timeout
            preemptive_generation=True,  # Enable to reduce latency
        )
        logger.info("Agent session created successfully")
        
    except Exception as e: 
        logger.error(f"Failed to initialize interview components: {e}")
        logger.debug(f"Initialization error traceback: {traceback.format_exc()}")
        raise

    def _agent_false_interruption(ev: AgentFalseInterruptionEvent):
        logger.info("Resuming from false interruption", extra={"instructions": ev.extra_instructions})
        async def handle_interruption():
            try:
                await speak_text(session, "Please continue.")
            except Exception as e:
                logger.error(f"Error handling false interruption: {e}")
        asyncio.create_task(handle_interruption())

    # Enhanced event logging
    def _log_session_events(event_name):
        def handler(*args, **kwargs):
            logger.debug(f"Session event '{event_name}': args={args}, kwargs={kwargs}")
        return handler
    
    session.on("agent_false_interruption", _agent_false_interruption)
    session.on("connected", _log_session_events("connected"))
    session.on("disconnected", _log_session_events("disconnected"))
    
    logger.debug("Session event handlers registered")

    async def interview_flow():
        # Initial greeting (handled by session.say)
        greeting = f"Good morning {bot.candidate_name}, thank you for joining this interview for the {bot.jd['role']} position. How are you today?"
        logger.info(f"Initiating greeting: {greeting}")  # Debug: Log greeting
        await session.say(greeting, allow_interruptions=False)
        logger.info(f"Greeting completed")  # Debug: Confirm greeting

        # Handle response and proceed with enhanced retry logic
        greeting_attempts = 0
        max_greeting_attempts = 3
        response = None
        
        while greeting_attempts < max_greeting_attempts and not response:
            greeting_attempts += 1
            logger.debug(f"Waiting for greeting response (attempt {greeting_attempts})")
            response = await get_transcription(session, timeout=45)  # Longer timeout for greeting
            
            if response:
                await bot.store_response("How are you today?", response)
                bot.responses.append({"question": "How are you today?", "response": response})
                await speak_text(session, "Great to hear! Let's begin.")
                break
            else:
                if greeting_attempts < max_greeting_attempts:
                    logger.info(f"No response to greeting (attempt {greeting_attempts}), trying again")
                    await speak_text(session, "I can't hear you clearly. Can you please respond - how are you today?")
                    await asyncio.sleep(2)  # Brief pause before retry
                else:
                    logger.info("No response to greeting after multiple attempts, proceeding")
                    await speak_text(session, "I'll assume you're doing well. Let's proceed with the interview.")

        # Introductory questions with enhanced retry logic
        intro_questions = ["Tell me about yourself.", f"Why are you interested in the {bot.jd['role']} role?"]
        for question in intro_questions:
            question_attempts = 0
            max_question_attempts = 2
            response = None
            
            while question_attempts < max_question_attempts and not response:
                question_attempts += 1
                logger.debug(f"Asking intro question (attempt {question_attempts}): {question}")
                
                await speak_text(session, question)
                response = await get_transcription(session, timeout=45)  # Longer timeout for complex questions
                
                if response:
                    await bot.store_response(question, response)
                    bot.responses.append({"question": question, "response": response})
                    logger.info(f"Received response to intro question: {response[:100]}...")
                    break
                else:
                    if question_attempts < max_question_attempts: 
                        logger.info(f"No response to '{question}' (attempt {question_attempts}), rephrasing")
                        # Rephrase the question to be more engaging
                        if "about yourself" in question.lower():
                            await speak_text(session, "Could you briefly introduce yourself and tell me about your background?")
                        else:
                            await speak_text(session, "What interests you about this position?")
                        await asyncio.sleep(1)
                    else:
                        logger.warning(f"No response to intro question after {max_question_attempts} attempts")
                        await speak_text(session, "Let's move on to the technical questions.")

        # Core questioning phase with improved topic management
        topics = bot.jd["skills"] + [p["name"] for p in bot.resume["projects"]]
        current_topic_questions = 0
        max_questions_per_topic = 3
        
        for topic in topics:
            # Check if we have time remaining (with potential for extension)
            remaining_time = bot.get_remaining_time(with_extension=True)
            if remaining_time <= 2:  # Less than 2 minutes remaining
                logger.info(f"Insufficient time remaining ({remaining_time:.1f} min), ending interview")
                break
            
            logger.info(f"Starting topic: {topic} (Remaining time: {remaining_time:.1f} min)")
            progress = bot.get_interview_progress()
            logger.info(f"Interview progress: {progress}")
            
            current_topic_questions = 0
            topic_context = f"We're now discussing {topic}"
            
            # Ask transition question to introduce topic
            if topic in bot.jd["skills"]:
                await speak_text(session, f"Now let's talk about {topic}.")
            else:
                await speak_text(session, f"I'd like to discuss your {topic} project.")
            
            while current_topic_questions < max_questions_per_topic:
                # Dynamic time check with extension possibility
                remaining_time = bot.get_remaining_time()
                if remaining_time <= 1:  # Base time exhausted
                    if bot.should_extend_interview("normal"):
                        bot.adaptive_extensions_used += 1
                        logger.info(f"Extending interview (extension #{bot.adaptive_extensions_used})")
                        await speak_text(session, "I'd like to explore this topic a bit more.")
                    else:
                        logger.info(f"Time limit reached, no extension possible")
                        break
                
                # Generate contextual question
                question = await bot.generate_question(session, topic, topic_context)
                logger.info(f"Asking question {current_topic_questions + 1} for topic {topic}: {question}")
                
                await speak_text(session, question)
                
                # Enhanced response handling with retries
                response = None
                response_attempts = 0
                max_response_attempts = 2
                
                while response_attempts < max_response_attempts and not response:
                    response_attempts += 1
                    logger.debug(f"Waiting for response to technical question (attempt {response_attempts})")
                    response = await get_transcription(session, timeout=60)  # Longer timeout for technical questions
                    
                    if not response and response_attempts < max_response_attempts:
                        logger.info(f"No response to technical question (attempt {response_attempts}), prompting")
                        await speak_text(session, "Take your time. Could you share your thoughts on this?")
                        await asyncio.sleep(2)
                
                if response:
                    await bot.store_response(question, response)
                    bot.responses.append({"question": question, "response": response})
                    current_topic_questions += 1
                    
                    # Mark topic as covered
                    bot.mark_topic_covered(topic)
                    
                    logger.info(f"Received technical response ({len(response)} chars): {response[:100]}...")
                    
                    # Assess response quality for extension decisions
                    response_quality = "normal"
                    if len(response.strip()) > 100 and any(keyword in response.lower() for keyword in ["implemented", "developed", "built", "designed", "optimized"]):
                        response_quality = "detailed"
                    elif len(response.strip()) > 200:
                        response_quality = "excellent"
                    elif len(response.strip()) < 20 or "i don't know" in response.lower():
                        response_quality = "brief"
                    
                    # Update topic context based on response
                    topic_context += f" The candidate mentioned: {response[:100]}..."
                    
                    # Check if response needs follow-up
                    if response_quality == "brief":
                        if current_topic_questions < max_questions_per_topic:
                            follow_up = await bot.generate_question(session, topic, f"The candidate gave a brief or uncertain response: '{response}'. Ask a follow-up question to encourage more detail or try a different angle.")
                            logger.info(f"Follow-up for brief response: {follow_up}")
                            await speak_text(session, follow_up)
                            follow_up_response = await get_transcription(session, timeout=30)
                            if follow_up_response:
                                await bot.store_response(follow_up, follow_up_response)
                                bot.responses.append({"question": follow_up, "response": follow_up_response})
                                current_topic_questions += 1
                                topic_context += f" Follow-up response: {follow_up_response[:100]}..."
                    
                    # Consider extension if candidate is giving excellent responses
                    elif response_quality in ["detailed", "excellent"]:
                        remaining_time = bot.get_remaining_time()
                        if remaining_time <= 3 and bot.should_extend_interview(response_quality):
                            bot.adaptive_extensions_used += 1
                            logger.info(f"Extending interview due to {response_quality} response quality")
                            await speak_text(session, "That's very interesting. Let me ask one more question about this.")
                    
                    # Check if candidate mentioned related topics to explore
                    response_lower = response.lower()
                    mentioned_skills = [skill for skill in bot.jd["skills"] if skill.lower() in response_lower]
                    if mentioned_skills and current_topic_questions < max_questions_per_topic:
                        related_skill = mentioned_skills[0]
                        if related_skill != topic:
                            topic_context += f" Candidate mentioned {related_skill}, exploring connection to {topic}"
                
                else:
                    logger.warning(f"No response received after {max_response_attempts} attempts for: {question}")
                    # Don't give up immediately - try to re-engage
                    await speak_text(session, "I understand technical questions can be challenging. Let's try a different approach.")
                    
                    # Try a simpler follow-up question
                    simple_question = f"Have you used {topic} in any of your projects?"
                    logger.info(f"Trying simpler follow-up: {simple_question}")
                    await speak_text(session, simple_question)
                    
                    simple_response = await get_transcription(session, timeout=30)
                    if simple_response:
                        await bot.store_response(simple_question, simple_response)
                        bot.responses.append({"question": simple_question, "response": simple_response})
                        logger.info(f"Got response to simplified question: {simple_response}")
                        bot.mark_topic_covered(topic)  # Still mark as covered
                    else:
                        logger.warning(f"No response even to simplified question about {topic}")
                    
                    current_topic_questions += 1  # Count as attempted question

        # Closing
        closing = f"Thank you, {bot.candidate_name}. This concludes the interview. We'll be in touch soon."
        logger.info(f"Closing interview with name: {bot.candidate_name}")  # Debug: Log closing
        await session.say(closing, allow_interruptions=False)
        logger.info(f"Closing message completed")  # Debug: Confirm closing

    # Start the session with enhanced error handling
    try:
        logger.info("Loading system prompt...")
        try:
            with open("system_prompt.txt", "r") as f:
                system_prompt = f.read()
            logger.info(f"Loaded system prompt: {system_prompt[:100]}...")  # Debug: Log first 100 chars
        except FileNotFoundError:
            logger.warning("system_prompt.txt not found, using default")
            system_prompt = "You are a professional AI interview bot conducting technical interviews. Be conversational, adaptive, and thorough."
            
        logger.info("Starting agent session...")
        await session.start(agent=Agent(instructions=system_prompt), room=ctx.room)
        logger.info("Session started successfully, initiating interview flow")
        
        # Add room connection logging
        logger.debug(f"Connected to room: {ctx.room.name if ctx.room else 'Unknown'}")
        
        await interview_flow()
        
    except Exception as e:
        logger.error(f"Critical error during interview: {e}")
        logger.debug(f"Critical error traceback: {traceback.format_exc()}")
        try:
            await speak_text(session, "I apologize, but we've encountered a technical issue. Thank you for your time.")
        except Exception as speak_error:
            logger.error(f"Failed to deliver error message to candidate: {speak_error}")
    finally:
        logger.info("Cleaning up session...")
        try:
            await session.aclose()  # Ensure session cleanup
            logger.info("Session closed successfully")
        except Exception as e:
            logger.error(f"Error closing session: {e}")
            logger.debug(f"Session close error traceback: {traceback.format_exc()}")
        logger.info("=== INTERVIEW BOT FINISHED ===")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
