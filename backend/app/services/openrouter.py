"""OpenRouter API client for AI features."""

from openai import OpenAI

from app.config import settings


class OpenRouterClient:
    """Client for OpenRouter API."""

    def __init__(self):
        self.api_key = settings.openrouter_api_key
        self.model = settings.openrouter_model
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
        )

    async def generate(self, prompt: str, max_tokens: int = 1000) -> str:
        """Generate text using OpenRouter API."""
        if not self.api_key:
            raise ValueError("OpenRouter API key not configured")

        completion = self.client.chat.completions.create(
            extra_headers={
                "HTTP-Referer": "https://tarregasheets.com",
                "X-Title": "TarregaSheets",
            },
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
        )

        return completion.choices[0].message.content


# Global client instance
openrouter_client = OpenRouterClient()
