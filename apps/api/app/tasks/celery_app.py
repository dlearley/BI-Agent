from __future__ import annotations

"""Celery application instance for background tasks."""

from celery import Celery

from ..config import settings


celery_app = Celery(
    "connector_api",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["apps.api.app.tasks.datasource"],
)

celery_app.conf.task_always_eager = settings.celery_task_always_eager
celery_app.conf.task_eager_propagates = settings.celery_task_eager_propagates
