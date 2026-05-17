from datetime import datetime, timezone

from app.extensions import db
from app.models import EmailVerificationCode, PasswordResetCode, User
from app.services.email_service import (
    EmailSendError,
    send_password_reset_email,
    send_verification_email,
)
from app.utils.auth_utils import (
    code_expiry,
    create_access_token,
    generate_six_digit_code,
    hash_code,
    hash_password,
    normalize_email,
    verify_code,
    verify_password,
)


class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _issue_verification_code(user: User) -> str:
    EmailVerificationCode.query.filter_by(user_id=user.id, used_at=None).update(
        {"used_at": datetime.now(timezone.utc)}
    )
    code = generate_six_digit_code()
    db.session.add(
        EmailVerificationCode(
            user_id=user.id,
            code_hash=hash_code(code),
            expires_at=code_expiry(30),
        )
    )
    db.session.commit()
    send_verification_email(user.email, code)
    return code


def register_user(email: str, password: str) -> User:
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters")

    normalized = normalize_email(email)
    if User.query.filter_by(email=normalized).first():
        raise AuthError("An account with this email already exists", 409)

    user = User(
        email=normalized,
        password_hash=hash_password(password),
        email_verified=False,
    )
    db.session.add(user)
    db.session.commit()

    try:
        _issue_verification_code(user)
    except EmailSendError as exc:
        raise AuthError(
            "Account created but we could not send a verification email. "
            "Use resend verification or try again later.",
            503,
        ) from exc

    return user


def sign_in_user(email: str, password: str) -> tuple[User, str]:
    normalized = normalize_email(email)
    user = User.query.filter_by(email=normalized).first()
    if not user or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password", 401)

    if not user.email_verified:
        raise AuthError("Please verify your email before signing in", 403)

    return user, create_access_token(user.id, user.email)


def verify_email(email: str, code: str) -> User:
    normalized = normalize_email(email)
    user = User.query.filter_by(email=normalized).first()
    if not user:
        raise AuthError("Invalid verification code", 400)

    record = (
        EmailVerificationCode.query.filter_by(user_id=user.id, used_at=None)
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < datetime.now(timezone.utc):
        raise AuthError("Verification code expired", 400)
    if not verify_code(code, record.code_hash):
        raise AuthError("Invalid verification code", 400)

    record.used_at = datetime.now(timezone.utc)
    user.email_verified = True
    db.session.commit()
    return user


def resend_verification(email: str) -> None:
    normalized = normalize_email(email)
    user = User.query.filter_by(email=normalized).first()
    if not user or user.email_verified:
        return

    try:
        _issue_verification_code(user)
    except EmailSendError as exc:
        raise AuthError(
            "Unable to send verification email. Please try again later.",
            503,
        ) from exc


def request_password_reset(email: str) -> None:
    normalized = normalize_email(email)
    user = User.query.filter_by(email=normalized).first()
    if not user:
        return

    PasswordResetCode.query.filter_by(user_id=user.id, used_at=None).update(
        {"used_at": datetime.now(timezone.utc)}
    )
    code = generate_six_digit_code()
    db.session.add(
        PasswordResetCode(
            user_id=user.id,
            code_hash=hash_code(code),
            expires_at=code_expiry(30),
        )
    )
    db.session.commit()

    try:
        send_password_reset_email(user.email, code)
    except EmailSendError as exc:
        raise AuthError(
            "Unable to send reset email. Please try again later.",
            503,
        ) from exc


def reset_password(email: str, code: str, password: str) -> None:
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters")

    normalized = normalize_email(email)
    user = User.query.filter_by(email=normalized).first()
    if not user:
        raise AuthError("Invalid reset code", 400)

    record = (
        PasswordResetCode.query.filter_by(user_id=user.id, used_at=None)
        .order_by(PasswordResetCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < datetime.now(timezone.utc):
        raise AuthError("Reset code expired", 400)
    if not verify_code(code, record.code_hash):
        raise AuthError("Invalid reset code", 400)

    record.used_at = datetime.now(timezone.utc)
    user.password_hash = hash_password(password)
    db.session.commit()
