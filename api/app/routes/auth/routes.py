from functools import wraps

import jwt
from flask import jsonify, request

from app.routes.auth import auth_bp
from app.services.auth_service import (
    AuthError,
    register_user,
    request_password_reset,
    resend_verification,
    reset_password,
    sign_in_user,
    verify_email,
)
from app.utils.auth_utils import decode_access_token


def _json_error(message: str, status: int):
    return jsonify({"success": False, "error": message}), status


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    if not email or not password:
        return _json_error("Email and password are required", 400)
    try:
        user = register_user(email, password)
        return jsonify(
            {
                "success": True,
                "data": {"user": user.to_public_dict()},
                "message": "Account created. Check your email for a verification code.",
            }
        ), 201
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


@auth_bp.post("/sign-in")
def sign_in():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    if not email or not password:
        return _json_error("Email and password are required", 400)
    try:
        user, token = sign_in_user(email, password)
        return jsonify(
            {
                "success": True,
                "data": {
                    "access_token": token,
                    "user": user.to_public_dict(),
                },
            }
        )
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


@auth_bp.post("/verify-email")
def verify_email_route():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    code = (data.get("code") or "").strip()
    if not email or not code:
        return _json_error("Email and verification code are required", 400)
    try:
        user = verify_email(email, code)
        return jsonify(
            {
                "success": True,
                "data": {"user": user.to_public_dict()},
                "message": "Email verified successfully.",
            }
        )
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


@auth_bp.post("/resend-verification")
def resend_verification_route():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        return _json_error("Email is required", 400)
    try:
        resend_verification(email)
        return jsonify(
            {
                "success": True,
                "message": "If an account exists, a new code has been sent.",
            }
        )
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        return _json_error("Email is required", 400)
    try:
        request_password_reset(email)
        return jsonify(
            {
                "success": True,
                "message": "If an account exists, a reset code has been sent.",
            }
        )
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


@auth_bp.post("/reset-password")
def reset_password_route():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    code = (data.get("code") or "").strip()
    password = data.get("password") or ""
    if not email or not code or not password:
        return _json_error("Email, code, and password are required", 400)
    try:
        reset_password(email, code, password)
        return jsonify(
            {
                "success": True,
                "message": "Password updated successfully.",
            }
        )
    except AuthError as exc:
        return _json_error(exc.message, exc.status_code)
    except ValueError as exc:
        return _json_error(str(exc), 400)


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return _json_error("Authentication required", 401)
        token = header[7:].strip()
        try:
            decode_access_token(token)
        except jwt.PyJWTError:
            return _json_error("Invalid or expired token", 401)
        return fn(*args, **kwargs)

    return wrapper


@auth_bp.get("/me")
@login_required
def me():
    header = request.headers.get("Authorization", "")
    token = header[7:].strip()
    payload = decode_access_token(token)
    return jsonify(
        {
            "success": True,
            "data": {
                "id": payload.get("sub"),
                "email": payload.get("email"),
            },
        }
    )
