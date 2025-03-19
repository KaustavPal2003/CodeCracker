from django.db import models

class ContestHistory(models.Model):
    username = models.CharField(max_length=100)
    platform = models.CharField(max_length=50)
    contest_data = models.JSONField()  # Raw data from fetch_all_async
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('username', 'platform')  # Prevent duplicates per platform