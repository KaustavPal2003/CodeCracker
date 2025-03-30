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

# Call only once
connect_to_mongodb()

# Application definition
INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',  # Added this line
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'tracker',
]

# ... (rest of your settings.py remains unchanged)

# ASGI application
ASGI_APPLICATION = 'codecracker.asgi.application'

# Channels configuration for WebSocket
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("127.0.0.1", 6379)],
        },
    }
}

# Middleware
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    #'debug_toolbar.middleware.DebugToolbarMiddleware',
]

# codecracker/settings.py
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / "static",  # Points to E:/Best_project/codecracker/static/
]
STATIC_ROOT = BASE_DIR / "staticfiles"  # For collectstatic in production

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

# Caching with Redis
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}

# Celery configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

# Debug Toolbar (for local dev)
INTERNAL_IPS = ['127.0.0.1']

# Content Security Policy (optional, requires django-csp)
# Install: pip install django-csp
# Add 'csp' to INSTALLED_APPS and configure:
# MIDDLEWARE += ['csp.middleware.CSPMiddleware']
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "ws://127.0.0.1:8000")
CSP_CONNECT_SRC = ("'self'", "ws://127.0.0.1:8000")
CSP_FRAME_ANCESTORS = ("'self'",)

# Root URL configuration
ROOT_URLCONF = 'codecracker.urls'

# Default auth model
AUTH_USER_MODEL = 'auth.User'