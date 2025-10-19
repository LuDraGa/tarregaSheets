"""Optical Music Recognition (OMR) scaffolding stubs.

TODO: Replace placeholder logic with full image-processing pipeline (deskewing, noise reduction,
binarization, symbol detection, text-based segmentation, object detection, score reconstruction...).
"""


def preprocess_score_image(image_bytes: bytes) -> bytes:
    """Return the original image bytes until OMR preprocessing is implemented."""
    # TODO: Implement deskewing, noise reduction, binarization, symbol detection, text-based segmentation,
    # object detection, and layout analysis...
    return image_bytes


def image_to_musicxml(image_bytes: bytes) -> bytes:
    """Placeholder image → MusicXML converter."""
    raise NotImplementedError(
        "OMR pipeline pending implementation. TODO: integrate preprocessing, staff detection, note "
        "segmentation, symbol classification, timing reconstruction, and MusicXML export..."
    )
