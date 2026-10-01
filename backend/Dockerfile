FROM python:3.11-slim

# ffmpeg removes location and device metadata from uploaded videos.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "uv>=0.8"
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .
RUN useradd --create-home beacon && mkdir -p /data/media && chown beacon /data/media
USER beacon

# Behind a reverse proxy, set FORWARDED_ALLOW_IPS to the proxy's address so rate
# limits and audit logs see the client's IP. Forwarded headers from anyone else
# are ignored.
ENV FORWARDED_ALLOW_IPS=127.0.0.1
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
