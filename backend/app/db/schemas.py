"""MongoDB schemas and indexes."""

from motor.motor_asyncio import AsyncIOMotorDatabase


async def create_indexes(db: AsyncIOMotorDatabase):
    """Create MongoDB indexes for collections."""

    # Pieces collection indexes
    await db.pieces.create_index("title")
    await db.pieces.create_index("composer")
    await db.pieces.create_index("tags")
    await db.pieces.create_index("created_at")

    # Practice stats collection indexes
    await db.practice_stats.create_index([("piece_id", 1), ("user_id", 1)])
    await db.practice_stats.create_index("last_played_at")

    print("MongoDB indexes created")
