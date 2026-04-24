from django.apps import AppConfig


class TrackerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tracker'

    def ready(self):
        # Connect to MongoDB lazily — only when Django is fully loaded.
        # This safely skips connection during collectstatic and migrate commands.
        import sys
        safe_commands = {'collectstatic', 'migrate', 'makemigrations', 'check', 'shell'}
        if not any(cmd in sys.argv for cmd in safe_commands):
            from codecracker.settings import connect_to_mongodb
            connect_to_mongodb()
