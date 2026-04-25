from pathlib import Path
import os
import urllib.parse
from mongoengine import connect
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

# Base directory for the project
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'your-default-secret-key')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')

# settings.py
_MONGO_CONNECTED = False


def connect_to_mongodb():
    global _MONGO_CONNECTED
    if _MONGO_CONNECTED:
        return  # No need to connect again

    username = urllib.parse.quote_plus(os.getenv('MONGO_USERNAME', ''))
    password = urllib.parse.quote_plus(os.getenv('MONGO_PASSWORD', ''))
    mongo_uri = (
        f"mongodb+srv://{username}:{password}@cluster1.3mai1.mongodb.net/"
        f"codecracker_db?retryWrites=true&w=majority"
    )

    try:
        connect(host=mongo_uri, alias='default')
        print("✅ Successfully connected to MongoDB!")
        _MONGO_CONNECTED = True
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {str(e)}")
        raise


# MongoDB is now connected lazily via TrackerConfig.ready() in tracker/apps.py
# This avoids crashing collectstatic, migrate, and Railway build steps.

SILENCED_SYSTEM_CHECKS = ['django_ratelimit.W001']

# Application definition
INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'tracker',
    'django_ratelimit',
]

# ASGI application
ASGI_APPLICATION = 'codecracker.asgi.application'

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')

# During Docker build (collectstatic), skip Redis-backed layers to avoid connection errors.
# DJANGO_COLLECTSTATIC=1 is only set in the Dockerfile RUN step, never at runtime.
_IS_BUILD = os.getenv('DJANGO_COLLECTSTATIC') == '1'

if _IS_BUILD:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [REDIS_URL],
            },
        }
    }

# Middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'csp.middleware.CSPMiddleware',
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / "static",
]
STATIC_ROOT = BASE_DIR / "staticfiles"
WHITENOISE_ROOT = BASE_DIR / "static"
# Templates
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'tracker/templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database (SQLite for Django ORM, MongoDB via MongoEngine)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Caching with Redis (use fake cache during Docker build)
if _IS_BUILD:
    CACHES = {'default': {'BACKEND': 'django.core.cache.backends.dummy.DummyCache'}}
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }

# Email (for password reset)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'

# Celery configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# Debug Toolbar (for local dev only)
INTERNAL_IPS = ['127.0.0.1']

# Content Security Policy
CSP_DEFAULT_SRC = ("'self'",)
CSP_FRAME_ANCESTORS = ("'self'",)

CSRF_TRUSTED_ORIGINS = [
    'https://codecracker-production.up.railway.app',
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Root URL configuration
ROOT_URLCONF = 'codecracker.urls'

# Default auth model
AUTH_USER_MODEL = 'auth.User'

APP_DOMAIN = os.getenv('APP_DOMAIN', '127.0.0.1:8000')
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", f"ws://{APP_DOMAIN}", f"wss://{APP_DOMAIN}")
CSP_CONNECT_SRC = ("'self'", f"ws://{APP_DOMAIN}", f"wss://{APP_DOMAIN}")
