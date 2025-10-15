"""Application configuration using pydantic-settings."""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from rich.console import Console
from rich.table import Table

console = Console()


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    app_name: str = "TarregaSheets API"
    debug: bool = False

    # Database
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "tarregasheets"

    # OpenRouter AI
    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-chat-v3-0324:free"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # File Upload
    max_upload_size: int = 50 * 1024 * 1024  # 50 MB
    allowed_file_types: list[str] = [
        "application/pdf",
        "application/vnd.recordare.musicxml+xml",
        "application/vnd.recordare.musicxml",
        "application/x-compressed",
        "audio/midi",
        "audio/x-midi",
    ]

    model_config = SettingsConfigDict(
        # Look for .env in project root (one level up from backend/)
        env_file="../.env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


def mask_secret(value: str, show_chars: int = 8) -> str:
    """Mask sensitive values, showing only first few characters."""
    if not value or len(value) <= show_chars:
        return "***NOT_SET***" if not value else "*" * len(value)
    return f"{value[:show_chars]}...{value[-4:]}" if len(value) > 12 else f"{value[:show_chars]}***"


def log_settings(settings: Settings):
    """Log settings with rich formatting."""
    console.print("\n[bold cyan]🎸 TarregaSheets Configuration[/bold cyan]\n")

    # Environment file check
    env_path = Path(__file__).parent.parent.parent / ".env"
    env_exists = env_path.exists()

    table = Table(title="Environment Variables", show_header=True, header_style="bold magenta")
    table.add_column("Setting", style="cyan", width=25)
    table.add_column("Value", style="green")
    table.add_column("Status", style="yellow")

    # .env file status
    table.add_row(
        ".env file",
        str(env_path),
        "✅ Found" if env_exists else "❌ Not Found"
    )

    # Database
    table.add_row(
        "MongoDB URL",
        mask_secret(settings.mongodb_url, 30) if settings.mongodb_url else "❌ NOT SET",
        "✅ Configured" if settings.mongodb_url != "mongodb://localhost:27017" else "⚠️  Using default"
    )
    table.add_row("Database Name", settings.database_name, "✅")

    # OpenRouter
    table.add_row(
        "OpenRouter API Key",
        mask_secret(settings.openrouter_api_key) if settings.openrouter_api_key else "❌ NOT SET",
        "✅ Configured" if settings.openrouter_api_key else "❌ Missing"
    )
    table.add_row("OpenRouter Model", settings.openrouter_model, "✅")

    # CORS
    table.add_row("CORS Origins", ", ".join(settings.cors_origins), "✅")

    console.print(table)
    console.print()

    # Warnings
    if not env_exists:
        console.print("[bold red]⚠️  Warning: .env file not found at project root![/bold red]")
        console.print(f"   Expected location: {env_path}")
        console.print("   Copy .env.example to .env and fill in your credentials.\n")

    if not settings.openrouter_api_key:
        console.print("[bold yellow]⚠️  Warning: OpenRouter API key not configured[/bold yellow]")
        console.print("   AI features will not work.\n")

    if settings.mongodb_url == "mongodb://localhost:27017":
        console.print("[bold yellow]⚠️  Warning: Using default MongoDB URL (localhost)[/bold yellow]")
        console.print("   Set MONGODB_URL in .env for MongoDB Atlas.\n")


# Global settings instance
settings = Settings()

# Log settings on import
log_settings(settings)
