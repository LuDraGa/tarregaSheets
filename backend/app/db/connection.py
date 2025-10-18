"""MongoDB connection management."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

# Global MongoDB client and database
mongodb_client: AsyncIOMotorClient | None = None
mongodb_database: AsyncIOMotorDatabase | None = None


async def connect_to_db():
    """Connect to MongoDB."""
    global mongodb_client, mongodb_database

    # TLS/SSL options for OpenSSL 3.x compatibility with MongoDB Atlas
    # OpenSSL 3.x has stricter security - these options bypass TLSV1_ALERT_INTERNAL_ERROR
    mongodb_client = AsyncIOMotorClient(
        settings.mongodb_url,
        tlsAllowInvalidCertificates=True,  # Required for OpenSSL 3.x + MongoDB Atlas
        tlsAllowInvalidHostnames=True,     # Bypass hostname verification issues
    )
    mongodb_database = mongodb_client[settings.database_name]
    print(f"Connected to MongoDB: {settings.database_name}")


async def close_db_connection():
    """Close MongoDB connection."""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        print("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance."""
    if mongodb_database is None:
        raise RuntimeError("Database not connected. Call connect_to_db() first.")
    return mongodb_database
