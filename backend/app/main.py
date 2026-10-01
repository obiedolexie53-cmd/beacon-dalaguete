"""FastAPI application entry point: `uvicorn app.main:app --reload`."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.headers import SecurityHeadersMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="BEACON API",
        version=__version__,
        description=(
            "Community-based disaster reporting and monitoring for the Municipality of "
            "Dalaguete, Cebu. Research prototype. Not a disaster prediction system."
        ),
        # Interactive docs are for development only.
        docs_url="/api/docs" if settings.environment != "production" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.environment != "production" else None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    # Added last so it wraps everything, including CORS and error responses.
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.environment == "production")
    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
