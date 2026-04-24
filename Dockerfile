FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pass dummy env vars so settings.py can be imported safely at build time.
# These are NOT used at runtime — Railway injects the real values then.
RUN DJANGO_SECRET_KEY="build-time-dummy-secret-key-not-used-in-prod" \
    DEBUG="False" \
    ALLOWED_HOSTS="localhost" \
    MONGO_USERNAME="build" \
    MONGO_PASSWORD="build" \
    REDIS_URL="redis://localhost:6379" \
    DJANGO_COLLECTSTATIC="1" \
    python manage.py collectstatic --noinput

EXPOSE 8000

CMD python manage.py migrate && daphne -b 0.0.0.0 -p ${PORT:-8000} codecracker.asgi:application
