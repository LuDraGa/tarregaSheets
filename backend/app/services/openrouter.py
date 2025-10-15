"""OpenRouter API client for AI features."""

import httpx

from app.config import settings


class OpenRouterClient:
    """Client for OpenRouter API."""

    def __init__(self):
        self.api_key = settings.openrouter_api_key
        self.model = settings.openrouter_model
        self.base_url = "https://openrouter.ai/api/v1"

    async def generate(self, prompt: str, max_tokens: int = 1000) -> str:
        """Generate text using OpenRouter API."""
        if not self.api_key:
            raise ValueError("OpenRouter API key not configured")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                },
                timeout=30.0,
            )

            response.raise_for_status()
            data = response.json()

            return data["choices"][0]["message"]["content"]


# Global client instance
openrouter_client = OpenRouterClient()
