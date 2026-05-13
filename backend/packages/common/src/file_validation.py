"""Magic-byte (content-sniffing) validation for user-uploaded files.

Extension and Content-Type are spoofable — a `.png` named file with a
PHP polyglot inside passes both. The first few bytes of a real file are
much harder to fake without breaking the file format itself. This
module exposes a single helper that compares the actual leading bytes
against an allow-list of well-known signatures.

Used by KYC document uploads and manual deposit screenshots — anywhere
a logged-in user can drop content onto our disk.
"""
from __future__ import annotations


# (signature_bytes, allowed_extensions) — the magic bytes here are the
# canonical file-format headers per the various RFCs / specs.
_SIGNATURES: list[tuple[bytes, tuple[str, ...]]] = [
    (b"\xFF\xD8\xFF",                 (".jpg", ".jpeg")),     # JPEG SOI
    (b"\x89PNG\r\n\x1a\n",            (".png",)),             # PNG signature
    (b"GIF87a",                       (".gif",)),
    (b"GIF89a",                       (".gif",)),
    (b"RIFF",                         (".webp",)),            # WEBP — second check on bytes 8..12
    (b"%PDF-",                        (".pdf",)),
]


def detect_kind(head: bytes) -> str | None:
    """Return the canonical extension implied by the first bytes of a
    file, or None if no signature matches. WEBP needs a secondary check
    because RIFF is a generic container."""
    if not head:
        return None
    for sig, exts in _SIGNATURES:
        if head.startswith(sig):
            if sig == b"RIFF":
                # WEBP layout: 'RIFF' + 4-byte size + 'WEBP'
                if len(head) >= 12 and head[8:12] == b"WEBP":
                    return ".webp"
                return None
            return exts[0]
    return None


def validate_upload(
    content: bytes,
    declared_ext: str,
    *,
    allowed_extensions: set[str],
    label: str = "file",
) -> str:
    """Confirm `content` is genuinely the format `declared_ext` claims.

    Returns the canonical extension on success. Raises ValueError when:
      - the magic bytes don't match any of our recognised types
      - the magic bytes match but the extension disagrees (a polyglot /
        spoof attempt)
      - the declared extension isn't in the caller's allow-list

    The caller is responsible for size limits + virus scanning — this
    only sniffs the format identity.
    """
    declared = (declared_ext or "").lower()
    if declared not in allowed_extensions:
        raise ValueError(f"{label}: extension {declared!r} not allowed")

    head = content[:32]  # 32 bytes is enough for every signature here
    detected = detect_kind(head)
    if detected is None:
        raise ValueError(
            f"{label}: file contents do not match a recognised image / PDF "
            f"format (extension said {declared!r})"
        )

    # Treat .jpg/.jpeg as interchangeable for the equality check.
    norm = ".jpg" if declared in (".jpg", ".jpeg") else declared
    norm_detected = ".jpg" if detected in (".jpg", ".jpeg") else detected
    if norm != norm_detected:
        raise ValueError(
            f"{label}: file content type ({detected}) does not match the "
            f"declared extension ({declared})"
        )
    return detected
