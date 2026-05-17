import resend
from flask import current_app


class EmailSendError(Exception):
    """Raised when Resend fails to deliver a message."""


def _send_email(*, to_email: str, subject: str, html: str) -> None:
    api_key = current_app.config.get("EMAIL_SENDER_API_KEY")
    if not api_key:
        raise EmailSendError("Email service is not configured")

    from_email = current_app.config.get("RESEND_FROM_EMAIL", "REPSA <onboarding@resend.dev>")
    resend.api_key = api_key

    try:
        resend.Emails.send(
            {
                "from": from_email,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
    except Exception as exc:
        current_app.logger.exception("Resend email failed for %s", to_email)
        raise EmailSendError("Unable to send email") from exc


def send_verification_email(to_email: str, code: str) -> None:
    html = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1E3A8A;">Verify your REPSA account</h2>
      <p>Enter this code on the verification screen to complete your registration:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #191919;">{code}</p>
      <p style="color: #4C4C4C; font-size: 14px;">This code expires in 30 minutes. If you did not create an account, you can ignore this email.</p>
    </div>
    """
    _send_email(
        to_email=to_email,
        subject="Your REPSA verification code",
        html=html,
    )


def send_password_reset_email(to_email: str, code: str) -> None:
    html = f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #1E3A8A;">Reset your REPSA password</h2>
      <p>Use this code to set a new password:</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #191919;">{code}</p>
      <p style="color: #4C4C4C; font-size: 14px;">This code expires in 30 minutes. If you did not request a reset, you can ignore this email.</p>
    </div>
    """
    _send_email(
        to_email=to_email,
        subject="Your REPSA password reset code",
        html=html,
    )
