"""Health check endpoints for MongoDB and OpenRouter API."""

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.db.connection import get_database
from app.services.openrouter import openrouter_client

router = APIRouter()


@router.get("/db")
async def check_database():
    """Check MongoDB connection."""
    try:
        db = get_database()
        # Ping the database
        await db.command("ping")
        return {
            "status": "healthy",
            "service": "mongodb",
            "database": settings.database_name,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}",
        )


@router.get("/openrouter")
async def check_openrouter():
    """Check OpenRouter API connection."""
    try:
        if not settings.openrouter_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenRouter API key not configured",
            )

        # Test with a simple prompt
        response = await openrouter_client.generate(
            "Say 'OK' if you can read this.", max_tokens=10
        )

        return {
            "status": "healthy",
            "service": "openrouter",
            "model": settings.openrouter_model,
            "response": response[:50],  # First 50 chars
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"OpenRouter API connection failed: {str(e)}",
        )


@router.get("/models")
async def list_available_models():
    """List available AI models."""
    models = [
        {
            "id": "moonshotai/kimi-k2:free",
            "name": "Moonshot AI Kimi K2",
            "provider": "Moonshot AI",
            "free": True,
        },
        {
            "id": "tngtech/deepseek-r1t2-chimera:free",
            "name": "DeepSeek R1T2 Chimera",
            "provider": "TNG Tech",
            "free": True,
        },
        {
            "id": "z-ai/glm-4.5-air:free",
            "name": "GLM 4.5 Air",
            "provider": "Z-AI",
            "free": True,
        },
        {
            "id": "tngtech/deepseek-r1t-chimera:free",
            "name": "DeepSeek R1T Chimera",
            "provider": "TNG Tech",
            "free": True,
        },
        {
            "id": "deepseek/deepseek-chat-v3-0324:free",
            "name": "DeepSeek Chat v3",
            "provider": "DeepSeek",
            "free": True,
        },
        {
            "id": "deepseek/deepseek-r1-0528:free",
            "name": "DeepSeek R1",
            "provider": "DeepSeek",
            "free": True,
        },
        {
            "id": "nvidia/nemotron-nano-9b-v2:free",
            "name": "Nemotron Nano 9B v2",
            "provider": "NVIDIA",
            "free": True,
        },
        {
            "id": "meta-llama/llama-3.3-8b-instruct:free",
            "name": "Llama 3.3 8B Instruct",
            "provider": "Meta",
            "free": True,
        },
    ]

    return {
        "models": models,
        "current": settings.openrouter_model,
    }
