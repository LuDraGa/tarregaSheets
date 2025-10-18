"""Async conversion job queue service.

Simple in-memory queue with threading for v1.
Can be upgraded to Celery/Redis for production scaling.
"""

import queue
import threading
import uuid
from datetime import datetime
from typing import Dict, Optional

import asyncio

from app.models.conversion import ConversionJob
from app.services.converter import ConversionError, convert_musicxml, validate_conversion_output
from app.services.parser import generate_midi


class ConversionQueue:
    """
    In-memory conversion job queue with background worker thread.

    This is a simple implementation for MVP. For production scaling,
    consider upgrading to Celery with Redis/RabbitMQ.
    """

    def __init__(self, max_workers: int = 1):
        """
        Initialize conversion queue.

        Args:
            max_workers: Number of background worker threads (default: 1)
        """
        self._queue: queue.Queue = queue.Queue()
        self._jobs: Dict[str, ConversionJob] = {}
        self._lock = threading.Lock()
        self._workers = []
        self._running = False
        self.max_workers = max_workers

    def start(self):
        """Start background worker threads."""
        if self._running:
            return

        self._running = True
        for i in range(self.max_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"ConversionWorker-{i}",
                daemon=True,
            )
            worker.start()
            self._workers.append(worker)

    def stop(self):
        """Stop background worker threads."""
        self._running = False
        # Add sentinel values to wake up workers
        for _ in range(self.max_workers):
            self._queue.put(None)

    def queue_conversion(
        self,
        piece_id: str,
        version_id: str,
        input_musicxml: bytes,
        from_notation: str,
        to_notation: str,
    ) -> str:
        """
        Queue a conversion job.

        Args:
            piece_id: Parent piece ID
            version_id: Version ID being converted
            input_musicxml: Source MusicXML bytes
            from_notation: Source notation type ("staff" or "tab")
            to_notation: Target notation type ("staff" or "tab")

        Returns:
            conversion_id: Unique job ID for status tracking
        """
        conversion_id = str(uuid.uuid4())

        # Create job record
        job = ConversionJob(
            id=conversion_id,
            piece_id=piece_id,
            version_id=version_id,
            from_notation=from_notation,
            to_notation=to_notation,
            status="queued",
            progress=0,
        )

        # Store job
        with self._lock:
            self._jobs[conversion_id] = job

        # Queue for processing
        self._queue.put({
            "conversion_id": conversion_id,
            "input_musicxml": input_musicxml,
        })

        return conversion_id

    def get_job_status(self, conversion_id: str) -> Optional[ConversionJob]:
        """
        Get conversion job status.

        Args:
            conversion_id: Job ID

        Returns:
            ConversionJob or None if not found
        """
        with self._lock:
            return self._jobs.get(conversion_id)

    def retry_conversion(self, conversion_id: str, input_musicxml: bytes) -> bool:
        """
        Retry a failed conversion.

        Args:
            conversion_id: Job ID to retry
            input_musicxml: Source MusicXML bytes

        Returns:
            True if queued for retry, False if job not found or not failed
        """
        with self._lock:
            job = self._jobs.get(conversion_id)
            if not job or job.status != "failed":
                return False

            # Reset job status
            job.status = "queued"
            job.progress = 0
            job.error_message = None
            job.updated_at = datetime.now()

        # Re-queue
        self._queue.put({
            "conversion_id": conversion_id,
            "input_musicxml": input_musicxml,
        })

        return True

    def _worker_loop(self):
        """Background worker thread that processes conversion jobs."""
        while self._running:
            try:
                # Get next job (blocking with timeout)
                task = self._queue.get(timeout=1.0)

                # Sentinel value to stop worker
                if task is None:
                    break

                conversion_id = task["conversion_id"]
                input_musicxml = task["input_musicxml"]

                # Process conversion
                self._process_conversion(conversion_id, input_musicxml)

            except queue.Empty:
                continue
            except Exception as e:
                # Log error but keep worker running
                print(f"Worker error: {e}")

    def _process_conversion(self, conversion_id: str, input_musicxml: bytes):
        """
        Process a single conversion job.

        Args:
            conversion_id: Job ID
            input_musicxml: Source MusicXML bytes
        """
        # Get job
        with self._lock:
            job = self._jobs.get(conversion_id)
            if not job:
                return

        try:
            # Update status to in_progress
            self._update_job(conversion_id, status="in_progress", progress=10)

            # Step 1: Convert MusicXML
            self._update_job(conversion_id, progress=30)
            converted_musicxml = convert_musicxml(
                input_musicxml,
                from_notation=job.from_notation,
                to_notation=job.to_notation,
                timeout=30,
            )

            # Step 2: Validate output
            self._update_job(conversion_id, progress=50)
            if not validate_conversion_output(converted_musicxml):
                raise ConversionError("Validation failed: Invalid MusicXML output")

            # Step 3: Generate MIDI from converted MusicXML
            self._update_job(conversion_id, progress=70)
            converted_midi = generate_midi(converted_musicxml, filename="converted.musicxml")

            # Step 4: Upload to GridFS
            self._update_job(conversion_id, progress=85)

            # Upload files using async functions (run in event loop)
            from app.services.storage import upload_file

            # Upload MusicXML
            musicxml_file_id = asyncio.run(upload_file(
                content=converted_musicxml,
                filename=f"{job.version_id}_converted_{job.to_notation}.musicxml",
                content_type="application/vnd.recordare.musicxml+xml",
                metadata={
                    "notation_type": job.to_notation,
                    "conversion_from": job.from_notation,
                    "conversion_job_id": conversion_id,
                    "piece_id": job.piece_id,
                    "version_id": job.version_id,
                }
            ))

            # Upload MIDI
            midi_file_id = asyncio.run(upload_file(
                content=converted_midi,
                filename=f"{job.version_id}_converted_{job.to_notation}.mid",
                content_type="audio/midi",
                metadata={
                    "notation_type": job.to_notation,
                    "conversion_from": job.from_notation,
                    "conversion_job_id": conversion_id,
                    "piece_id": job.piece_id,
                    "version_id": job.version_id,
                }
            ))

            # Step 5: Mark as completed
            self._update_job(
                conversion_id,
                status="completed",
                progress=100,
                output_musicxml_file_id=musicxml_file_id,
                output_midi_file_id=midi_file_id,
                completed_at=datetime.now(),
            )

        except ConversionError as e:
            # Conversion-specific error
            self._update_job(
                conversion_id,
                status="failed",
                error_message=str(e),
            )
        except Exception as e:
            # Unexpected error
            self._update_job(
                conversion_id,
                status="failed",
                error_message=f"Unexpected error: {str(e)}",
            )

    def _update_job(
        self,
        conversion_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        error_message: Optional[str] = None,
        output_musicxml_file_id: Optional[str] = None,
        output_midi_file_id: Optional[str] = None,
        completed_at: Optional[datetime] = None,
    ):
        """Update job status fields."""
        with self._lock:
            job = self._jobs.get(conversion_id)
            if not job:
                return

            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = progress
            if error_message is not None:
                job.error_message = error_message
            if output_musicxml_file_id is not None:
                job.output_musicxml_file_id = output_musicxml_file_id
            if output_midi_file_id is not None:
                job.output_midi_file_id = output_midi_file_id
            if completed_at is not None:
                job.completed_at = completed_at

            job.updated_at = datetime.now()


# Global queue instance
_global_queue: Optional[ConversionQueue] = None


def get_queue() -> ConversionQueue:
    """
    Get global conversion queue instance (singleton).

    Returns:
        ConversionQueue instance
    """
    global _global_queue
    if _global_queue is None:
        _global_queue = ConversionQueue(max_workers=1)
        _global_queue.start()
    return _global_queue
