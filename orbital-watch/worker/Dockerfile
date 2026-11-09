FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libexpat1 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir rasterio==1.5.2 numpy scipy pillow pystac-client requests "psycopg[binary]" \
 && useradd -u 10001 -m ow
COPY ow_worker.py /app/ow_worker.py
USER ow
WORKDIR /app
ENV PYTHONUNBUFFERED=1 GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR GDAL_HTTP_MAX_RETRY=3 GDAL_HTTP_RETRY_DELAY=2 GDAL_CACHEMAX=128 VSI_CACHE=FALSE
CMD ["python", "/app/ow_worker.py"]
