from django import template

register = template.Library()

@register.filter
def subtract(value, arg):
    """Subtract two numbers in Django templates."""
    try:
        return int(value) - int(arg)
    except (ValueError, TypeError):
        return 0
