"""
Django view for Supabase SSO authentication at /accounts/supabase/

This view handles SSO login from MOVI Digital (app.movi.digital) by validating
a Supabase JWT token, finding or creating the local Django user, initiating a
Django session, and redirecting to the requested page with postMessage support.

Requirements:
    pip install PyJWT cryptography requests

Settings required in Django settings.py:
    SUPABASE_URL = "https://qhwvuuyjhcennqccgvse.supabase.co"
    SUPABASE_JWT_SECRET = "<your-supabase-jwt-secret>"  # From Supabase Dashboard > Settings > API > JWT Secret
    MOVI_PARENT_ORIGIN = "https://app.movi.digital"
"""

import json
import logging
import time
from functools import lru_cache

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.shortcuts import redirect
from django.views import View

logger = logging.getLogger(__name__)

User = get_user_model()

SUPABASE_URL = getattr(settings, "SUPABASE_URL", "https://qhwvuuyjhcennqccgvse.supabase.co")
SUPABASE_JWT_SECRET = getattr(settings, "SUPABASE_JWT_SECRET", "")
MOVI_PARENT_ORIGIN = getattr(settings, "MOVI_PARENT_ORIGIN", "https://app.movi.digital")


@lru_cache(maxsize=1)
def _get_supabase_jwks():
    """Fetch JWKS from Supabase for RS256 validation (fallback)."""
    try:
        resp = requests.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def validate_supabase_jwt(token: str) -> dict | None:
    """
    Validate a Supabase access_token (JWT).

    Supabase uses HS256 signed with the project's JWT secret.
    The token contains: sub (user UUID), email, role, exp, iat, iss.
    """
    if not SUPABASE_JWT_SECRET:
        logger.error("SUPABASE_JWT_SECRET not configured in Django settings")
        return None

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={
                "verify_exp": True,
                "verify_iat": True,
                "require": ["sub", "exp", "iss"],
            },
            issuer=f"{SUPABASE_URL}/auth/v1",
            leeway=30,  # 30 seconds tolerance for clock skew
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Supabase JWT expired")
        return None
    except jwt.InvalidIssuerError:
        logger.warning("Supabase JWT invalid issuer")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Supabase JWT validation failed: {e}")
        return None


def get_user_email_from_token(payload: dict) -> str | None:
    """Extract email from JWT payload. Supabase stores it in 'email' claim."""
    return payload.get("email") or payload.get("user_metadata", {}).get("email")


def get_user_metadata_from_supabase(token: str) -> dict | None:
    """
    Optionally fetch full user profile from Supabase Auth API.
    Used to get additional user metadata (name, etc.) for user creation.
    """
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": getattr(settings, "SUPABASE_ANON_KEY", ""),
            },
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None


def find_or_create_user(email: str, supabase_uid: str, metadata: dict | None = None) -> User | None:
    """
    Find existing user by email or supabase_uid, or create a new one.

    Lookup priority:
    1. By supabase_uid field (if your User model has it)
    2. By email
    3. Create new user with minimal data
    """
    # Try by supabase_uid first (if model has this field)
    if hasattr(User, "supabase_uid"):
        user = User.objects.filter(supabase_uid=supabase_uid).first()
        if user:
            return user

    # Try by email
    user = User.objects.filter(email__iexact=email).first()
    if user:
        # Optionally store supabase_uid for future lookups
        if hasattr(user, "supabase_uid") and not user.supabase_uid:
            user.supabase_uid = supabase_uid
            user.save(update_fields=["supabase_uid"])
        return user

    # Auto-create user from MOVI Digital data
    try:
        user_data = {
            "email": email,
            "username": email,  # Use email as username
            "is_active": True,
        }

        if metadata:
            user_meta = metadata.get("user_metadata", {})
            user_data["first_name"] = user_meta.get("first_name", "")
            user_data["last_name"] = user_meta.get("last_name", "")

        if hasattr(User, "supabase_uid"):
            user_data["supabase_uid"] = supabase_uid

        user = User.objects.create_user(**user_data)
        user.set_unusable_password()
        user.save()

        logger.info(f"Created new user from MOVI SSO: {email}")
        return user
    except Exception as e:
        logger.error(f"Failed to create user {email}: {e}")
        return None


def build_postmessage_page(redirect_url: str, user, parent_origin: str) -> str:
    """
    Build an HTML page that:
    1. Sends bonos:userinfo postMessage to parent (MOVI iframe host)
    2. Sends bonos:pagechange postMessage
    3. Redirects to the target page
    """
    user_info = {
        "type": "bonos:userinfo",
        "role": getattr(user, "role", "") or getattr(user, "rol", "") or "agente",
        "can_admin": user.is_staff or user.is_superuser,
        "can_campanias": user.is_staff or user.is_superuser,
        "can_users": user.is_staff or user.is_superuser,
    }

    # If user has specific CP permissions, use those
    if hasattr(user, "cp_role"):
        user_info["role"] = user.cp_role
    if hasattr(user, "cp_can_admin"):
        user_info["can_admin"] = user.cp_can_admin
    if hasattr(user, "cp_can_campanias"):
        user_info["can_campanias"] = user.cp_can_campanias
    if hasattr(user, "cp_can_users"):
        user_info["can_users"] = user.cp_can_users

    page_info = {
        "type": "bonos:pagechange",
        "path": redirect_url,
    }

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Autenticando...</title></head>
<body>
<script>
(function() {{
    var parentOrigin = {json.dumps(parent_origin)};
    var userInfo = {json.dumps(user_info)};
    var pageInfo = {json.dumps(page_info)};

    // Send messages to parent iframe host
    if (window.parent && window.parent !== window) {{
        try {{
            window.parent.postMessage(userInfo, parentOrigin);
            window.parent.postMessage(pageInfo, parentOrigin);
        }} catch(e) {{
            console.warn('postMessage failed:', e);
        }}
    }}

    // Redirect to target page
    window.location.replace({json.dumps(redirect_url)});
}})();
</script>
<noscript><meta http-equiv="refresh" content="0;url={redirect_url}"></noscript>
</body>
</html>"""


class SupabaseSSOView(View):
    """
    Handle SSO authentication from MOVI Digital.

    URL: /accounts/supabase/?token=<jwt>&next=/
    """

    def get(self, request):
        token = request.GET.get("token", "").strip()
        next_url = request.GET.get("next", "/")

        if not token:
            return self._error_response(
                "Token no proporcionado",
                "No se recibio un token de autenticacion.",
                status=400,
            )

        # Validate JWT
        payload = validate_supabase_jwt(token)
        if payload is None:
            return self._error_response(
                "Token invalido o expirado",
                "El token JWT de Supabase no es valido. "
                "Verifica que SUPABASE_JWT_SECRET este configurado correctamente "
                "y que el token no haya expirado.",
                status=401,
            )

        # Extract email
        email = get_user_email_from_token(payload)
        if not email:
            return self._error_response(
                "Email no encontrado",
                "El token no contiene un email valido.",
                status=400,
            )

        supabase_uid = payload.get("sub", "")

        # Optionally fetch full user metadata
        metadata = get_user_metadata_from_supabase(token)

        # Find or create Django user
        user = find_or_create_user(email, supabase_uid, metadata)
        if user is None:
            return self._error_response(
                "Error creando usuario",
                f"No se pudo encontrar o crear el usuario con email {email}.",
                status=500,
            )

        if not user.is_active:
            return self._error_response(
                "Usuario inactivo",
                "Tu cuenta esta desactivada en Central de Produccion.",
                status=403,
            )

        # Create Django session
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")

        # Return intermediate page that sends postMessage then redirects
        html = build_postmessage_page(next_url, user, MOVI_PARENT_ORIGIN)
        return HttpResponse(html, content_type="text/html")

    def _error_response(self, title: str, detail: str, status: int = 400):
        """
        Return error as JSON (for programmatic consumers) or HTML with postMessage
        to notify the parent frame of the failure.
        """
        error_payload = {
            "type": "bonos:navigate",
            "path": "/accounts/login",
            "error": title,
        }

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Error SSO</title></head>
<body>
<script>
(function() {{
    var parentOrigin = {json.dumps(MOVI_PARENT_ORIGIN)};
    if (window.parent && window.parent !== window) {{
        try {{
            window.parent.postMessage({json.dumps(error_payload)}, parentOrigin);
        }} catch(e) {{}}
    }}
}})();
</script>
<h2>{title}</h2>
<p>{detail}</p>
</body>
</html>"""
        return HttpResponse(html, content_type="text/html", status=status)
