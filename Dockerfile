# REST API for a Schichtplaner 5 database. Mount the database directory at /data.
#   docker build -t sp5api .
#   docker run --rm -p 8000:8000 -v /path/to/data:/data:ro sp5api
FROM python:3.13-slim
COPY lib /src/lib
COPY api /src/api
RUN pip install --no-cache-dir /src/lib /src/api && rm -rf /src
ENV SP5_DB_PATH=/data
USER nobody
EXPOSE 8000
CMD ["sp5api", "--host", "0.0.0.0"]
