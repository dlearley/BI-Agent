from __future__ import annotations

"""Key management abstractions for encrypting datasource credentials."""

import base64
from abc import ABC, abstractmethod
from typing import Optional

from cryptography.fernet import Fernet

from ..config import Settings, settings


class KMSClient(ABC):
    """Interface for encrypting and decrypting secrets."""

    name: str

    @abstractmethod
    def encrypt(self, plaintext: bytes) -> str:
        """Encrypt the provided plaintext bytes."""

    @abstractmethod
    def decrypt(self, ciphertext: str) -> bytes:
        """Decrypt the provided ciphertext and return plaintext bytes."""


class LocalFernetKMS(KMSClient):
    """Lightweight Fernet-based implementation for local development."""

    name = "local_fernet"

    def __init__(self, key: Optional[str] = None) -> None:
        if key is None:
            raw_key = Fernet.generate_key()
        else:
            raw_key = key.encode() if isinstance(key, str) else key
        self._key = raw_key
        self._fernet = Fernet(self._key)

    @property
    def key(self) -> str:
        return self._key.decode()

    def encrypt(self, plaintext: bytes) -> str:
        return self._fernet.encrypt(plaintext).decode()

    def decrypt(self, ciphertext: str) -> bytes:
        return self._fernet.decrypt(ciphertext.encode())


class AWSKMSPlaceholder(KMSClient):
    """Placeholder KMS implementation simulating AWS KMS behaviour."""

    name = "aws_kms"

    def __init__(self, key_id: Optional[str] = None) -> None:
        self.key_id = key_id or "local-aws-placeholder"

    def encrypt(self, plaintext: bytes) -> str:
        # Placeholder behaviour: base64 encode with key identifier hint.
        payload = base64.urlsafe_b64encode(plaintext).decode()
        return f"{self.key_id}:{payload}"

    def decrypt(self, ciphertext: str) -> bytes:
        try:
            _, payload = ciphertext.split(":", 1)
        except ValueError as exc:  # pragma: no cover - defensive
            raise ValueError("Invalid ciphertext for AWS KMS placeholder") from exc
        return base64.urlsafe_b64decode(payload.encode())


def build_kms(settings_obj: Settings = settings) -> KMSClient:
    """Construct the configured KMS provider."""

    provider = settings_obj.kms_provider.lower()
    if provider in {"local", "local_fernet"}:
        return LocalFernetKMS(settings_obj.kms_fernet_key)
    if provider in {"aws", "aws_kms"}:
        return AWSKMSPlaceholder(settings_obj.kms_aws_key_id)
    raise ValueError(f"Unsupported KMS provider: {settings_obj.kms_provider}")


kms_client: KMSClient = build_kms()
