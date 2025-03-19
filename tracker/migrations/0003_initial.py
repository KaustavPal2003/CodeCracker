# Generated by Django 5.1.6 on 2025-03-06 17:21

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('tracker', '0002_delete_userstats'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserStats',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(max_length=255, unique=True)),
                ('codeforces_rating', models.IntegerField(default=0)),
                ('leetcode_solved', models.IntegerField(default=0)),
                ('codechef_rating', models.IntegerField(default=0)),
            ],
        ),
    ]
