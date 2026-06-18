"""
Configuration and deployment instructions for Supabase SSO on cp.movi.digital
==============================================================================

1. INSTALL DEPENDENCIES
-----------------------
pip install PyJWT cryptography requests

2. DJANGO SETTINGS (settings.py)
---------------------------------
Add/update these settings:

    # Supabase SSO Configuration
    SUPABASE_URL = "https://qhwvuuyjhcennqccgvse.supabase.co"
    SUPABASE_JWT_SECRET = "<JWT-SECRET-FROM-SUPABASE-DASHBOARD>"
    SUPABASE_ANON_KEY = "<ANON-KEY-FROM-SUPABASE-DASHBOARD>"
    MOVI_PARENT_ORIGIN = "https://app.movi.digital"

    # The JWT secret is found in:
    #   Supabase Dashboard > Project Settings > API > JWT Secret
    #   It's the same secret used to sign all access tokens.

3. MIDDLEWARE (settings.py)
---------------------------
Add the postMessage middleware AFTER SessionMiddleware and AuthenticationMiddleware:

    MIDDLEWARE = [
        ...
        'django.contrib.sessions.middleware.SessionMiddleware',
        'django.contrib.auth.middleware.AuthenticationMiddleware',
        ...
        'accounts.middleware_postmessage.IframePostMessageMiddleware',
    ]

4. URLS (urls.py)
-----------------
In your root urls.py, include the accounts URLs:

    from django.urls import path, include

    urlpatterns = [
        ...
        path('accounts/', include('accounts.urls')),
        ...
    ]

5. X-FRAME-OPTIONS
------------------
Django's default X-Frame-Options is 'DENY'. The middleware overrides this
per-response, but you should also set the global default to SAMEORIGIN:

    X_FRAME_OPTIONS = 'SAMEORIGIN'

Or remove Django's XFrameOptionsMiddleware entirely and rely on the
Content-Security-Policy header set by our middleware.

6. CSRF EXEMPTION
-----------------
The SSO view uses GET only (no CSRF needed). However, if you use
CsrfViewMiddleware, the GET request won't be affected.

If you need POST-based SSO in the future, add:

    from django.views.decorators.csrf import csrf_exempt
    # and decorate the view or add to CSRF_EXEMPT_URLS

7. USER MODEL COMPATIBILITY
----------------------------
The SSO view works with Django's default User model. If your User model
has custom fields for CP permissions, add these fields:

    class User(AbstractUser):
        supabase_uid = models.CharField(max_length=255, blank=True, null=True, unique=True)
        cp_role = models.CharField(max_length=50, default='agente')
        cp_can_admin = models.BooleanField(default=False)
        cp_can_campanias = models.BooleanField(default=False)
        cp_can_users = models.BooleanField(default=False)

If you DON'T have these fields, the view will still work - it will use
is_staff/is_superuser as fallback for permissions.

8. SESSION CONFIGURATION
-------------------------
Ensure your session backend works for cross-origin (iframe) usage:

    SESSION_COOKIE_SAMESITE = 'None'    # Required for cross-site iframe
    SESSION_COOKIE_SECURE = True         # Required when SameSite=None
    CSRF_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SECURE = True

9. ALLOWED HOSTS
-----------------
    ALLOWED_HOSTS = ['cp.movi.digital', ...]

10. VERIFICATION
-----------------
Test the SSO flow:
    1. Get a valid Supabase access token from app.movi.digital (browser devtools > Application > Storage > supabase session)
    2. Visit: https://cp.movi.digital/accounts/supabase/?token=<JWT>&next=/
    3. Expected: Redirect to / with a valid Django session

If you see the login form instead:
    - Check SUPABASE_JWT_SECRET matches the one in Supabase Dashboard
    - Check the token hasn't expired (tokens expire after 1 hour by default)
    - Check Django logs for validation error messages
    - Verify SESSION_COOKIE_SAMESITE = 'None' is set (critical for iframe)

11. COOKIE ISSUES IN IFRAME
-----------------------------
Modern browsers (Chrome 80+, Safari) block third-party cookies by default.
Since cp.movi.digital is loaded inside an iframe on app.movi.digital,
the session cookie is considered "third-party".

Solutions (pick one):
    a) Use same top-level domain: serve CP from produccion.movi.digital
       and set SESSION_COOKIE_DOMAIN = '.movi.digital'
       (RECOMMENDED - both share .movi.digital)

    b) Chrome's Partitioned cookies (CHIPS):
       SESSION_COOKIE_SAMESITE = 'None'
       SESSION_COOKIE_SECURE = True
       Add 'Partitioned' attribute to Set-Cookie header

    c) Storage Access API (requires user interaction)

Since BOTH app.movi.digital and cp.movi.digital share the .movi.digital
domain, option (a) is simplest:

    SESSION_COOKIE_DOMAIN = '.movi.digital'
    SESSION_COOKIE_SAMESITE = 'Lax'  # Can use Lax since same domain
    SESSION_COOKIE_SECURE = True

12. FINDING THE JWT SECRET
----------------------------
    1. Go to https://supabase.com/dashboard
    2. Select project: qhwvuuyjhcennqccgvse
    3. Go to Project Settings > API
    4. Under "JWT Settings", copy the "JWT Secret"
    5. Set it as SUPABASE_JWT_SECRET in your Django settings

IMPORTANT: The JWT Secret is NOT the anon key or service_role key.
It's a separate base64-encoded secret used to sign/verify JWTs.
"""
