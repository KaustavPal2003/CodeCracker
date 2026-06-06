import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'codecracker.settings')
django.setup()

from django.contrib.auth.models import User

username = os.getenv('ADMIN_USERNAME', 'admin')
password = os.getenv('ADMIN_PASSWORD', 'changeme')

if not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username, '', password)
    print(f'Superuser {username} created')
else:
    print(f'Superuser {username} already exists')