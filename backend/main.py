"""FastAPI entrypoint for corn-leaf FAW inference."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes.detection import router
from backend.services.inference import get_inference_service

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Touch the service so a present weights file is loaded at startup.
    get_inference_service().status()
    yield


app = FastAPI(title="Corn Leaf FAW Detection", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


@app.get("/health")
def health() -> dict:
    return {"ok": True}
