# E:/Best_project/codecracker/reset_users.py
import os
import sys
import django
from django.conf import settings

# Set the DJANGO_SETTINGS_MODULE environment variable
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'codecracker.settings')

# Add project directory to sys.path to ensure settings module is found
project_path = 'E:/Best_project/codecracker'
if project_path not in sys.path:
    sys.path.append(project_path)

# Configure Django settings
try:
    django.setup()
except Exception as e:
    print(f"Error setting up Django: {str(e)}")
    sys.exit(1)

# Now import User model after setup
from django.contrib.auth.models import User

def reset_users_and_create_superuser():
    # Step 1: Delete all existing users
    try:
        user_count = User.objects.count()
        User.objects.all().delete()
        print(f"Deleted {user_count} Django users successfully.")
    except Exception as e:
        print(f"Error deleting users: {str(e)}")

    # Step 2: Verify deletion
    remaining_users = User.objects.count()
    print(f"Remaining users: {remaining_users}")
    if remaining_users != 0:
        print("Warning: Some users were not deleted.")

    # Step 3: Create a new superuser
    try:
        username = "admin"
        email = "test@example.com"
        password = "newpassword123"
        
        if User.objects.filter(username=username).exists():
            print(f"User '{username}' already exists. Skipping creation.")
        else:
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            print(f"Created superuser: {username} with email {email} and password {password}")
    except Exception as e:
        print(f"Error creating superuser: {str(e)}")

    # Step 4: Verify creation
    if User.objects.filter(username=username).exists():
        print(f"Superuser '{username}' is ready. You can log in with password '{password}'.")
    else:
        print("Superuser creation failed.")

if __name__ == "__main__":
    reset_users_and_create_superuser()