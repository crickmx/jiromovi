"""
Django middleware to inject postMessage communication into every response.

This allows the MOVI Digital parent iframe to track navigation within
Central de Produccion and receive user permission data.

Add to MIDDLEWARE in settings.py:
    'accounts.middleware_postmessage.IframePostMessageMiddleware'
"""

import json
import re

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

MOVI_PARENT_ORIGIN = getattr(settings, "MOVI_PARENT_ORIGIN", "https://app.movi.digital")

SCRIPT_TEMPLATE = """
<script data-movi-bridge>
(function() {
    if (window.parent === window) return; // Not in iframe
    var origin = %s;
    var path = window.location.pathname;

    // Notify parent of page change
    window.parent.postMessage({type: 'bonos:pagechange', path: path}, origin);

    // Send user info if available
    var userInfo = document.querySelector('meta[name="movi-user-info"]');
    if (userInfo) {
        try {
            var data = JSON.parse(userInfo.getAttribute('content'));
            data.type = 'bonos:userinfo';
            window.parent.postMessage(data, origin);
        } catch(e) {}
    }

    // Listen for navigation commands from parent
    window.addEventListener('message', function(event) {
        if (event.origin !== origin) return;
        if (!event.data || !event.data.type) return;

        if (event.data.type === 'bonos:navigate' && event.data.url) {
            window.location.href = event.data.url;
        }
        if (event.data.type === 'bonos:theme') {
            var payload = event.data.payload || {};
            document.documentElement.setAttribute('data-theme', payload.theme || 'light');
            if (payload.accentColor) {
                document.documentElement.style.setProperty('--accent-color', payload.accentColor);
            }
        }
    });
})();
</script>
"""


class IframePostMessageMiddleware(MiddlewareMixin):
    """
    Injects a <script> before </body> on HTML responses to enable
    bidirectional postMessage communication with the MOVI Digital parent frame.
    """

    def process_response(self, request, response):
        # Only inject into HTML responses
        content_type = response.get("Content-Type", "")
        if "text/html" not in content_type:
            return response

        # Skip if response is streaming or binary
        if getattr(response, "streaming", False):
            return response

        # Allow iframe embedding from MOVI Digital
        response["X-Frame-Options"] = f"ALLOW-FROM {MOVI_PARENT_ORIGIN}"
        # Modern browsers use CSP frame-ancestors
        response["Content-Security-Policy"] = (
            f"frame-ancestors 'self' {MOVI_PARENT_ORIGIN}"
        )

        try:
            content = response.content.decode("utf-8")
        except (UnicodeDecodeError, AttributeError):
            return response

        # Don't inject twice
        if "data-movi-bridge" in content:
            return response

        script = SCRIPT_TEMPLATE % json.dumps(MOVI_PARENT_ORIGIN)

        # Inject user info meta tag if user is authenticated
        if hasattr(request, "user") and request.user.is_authenticated:
            user = request.user
            user_meta = {
                "role": getattr(user, "role", "") or getattr(user, "rol", "") or "agente",
                "can_admin": user.is_staff or user.is_superuser,
                "can_campanias": user.is_staff or user.is_superuser,
                "can_users": user.is_staff or user.is_superuser,
            }
            if hasattr(user, "cp_role"):
                user_meta["role"] = user.cp_role
            if hasattr(user, "cp_can_admin"):
                user_meta["can_admin"] = user.cp_can_admin
            if hasattr(user, "cp_can_campanias"):
                user_meta["can_campanias"] = user.cp_can_campanias
            if hasattr(user, "cp_can_users"):
                user_meta["can_users"] = user.cp_can_users

            meta_tag = (
                f'<meta name="movi-user-info" content=\'{json.dumps(user_meta)}\'>'
            )
            content = content.replace("</head>", f"{meta_tag}\n</head>", 1)

        # Inject script before </body>
        if "</body>" in content:
            content = content.replace("</body>", f"{script}\n</body>", 1)
        else:
            content += script

        response.content = content.encode("utf-8")
        response["Content-Length"] = len(response.content)
        return response
