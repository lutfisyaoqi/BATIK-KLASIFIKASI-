FROM python:3.9-slim

# Install minimal system dependencies required for headless OpenCV and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user for safety
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Copy requirements from ml_service to keep service-specific deps
COPY --chown=user ml_service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy only needed files
COPY --chown=user . /app

EXPOSE 7860
CMD ["uvicorn", "ml_service.app:app", "--host", "0.0.0.0", "--port", "7860"]
