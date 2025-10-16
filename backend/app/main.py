"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import close_db_connection, connect_to_db
from app.routes import pieces, upload

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Guitar practice platform API for sheet music storage, playback, and transcription",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB on startup."""
    await connect_to_db()


@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown."""
    await close_db_connection()


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


# Include routers
from app.routes import files, health

app.include_router(pieces.router, prefix="/pieces", tags=["pieces"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(files.router, prefix="/files", tags=["files"])
app.include_router(health.router, prefix="/health", tags=["health"])
