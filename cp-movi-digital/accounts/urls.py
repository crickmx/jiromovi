"""
URL configuration for the accounts app on cp.movi.digital.

Add to your root urls.py:
    path('accounts/', include('accounts.urls')),
"""

from django.urls import path

from .views_supabase_sso import SupabaseSSOView

urlpatterns = [
    path("supabase/", SupabaseSSOView.as_view(), name="supabase_sso"),
]
