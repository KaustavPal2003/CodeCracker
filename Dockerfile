CMD python manage.py collectstatic --noinput && \
    python manage.py migrate && \
    python create_admin.py && \
    daphne -b 0.0.0.0 -p ${PORT:-8000} codecracker.asgi:application