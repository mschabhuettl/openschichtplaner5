# nginx container that serves the frontend static files
# and proxies /api/ requests to the backend
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our production config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create certbot webroot directory
RUN mkdir -p /var/www/certbot

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/api/health || exit 1
