import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_activation_email(to_email: str, activation_link: str) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP_HOST is not configured")

    message = EmailMessage()
    message["From"] = settings.smtp_from_email
    message["To"] = to_email
    message["Subject"] = "Activeer je ObsApp-account"
    message.set_content(
        f"Je bent uitgenodigd voor ObsApp.\n\n"
        f"Klik op deze link om je wachtwoord in te stellen en in te loggen:\n"
        f"{activation_link}\n\n"
        f"Als je geen account hebt aangemaakt, negeer deze mail dan."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_user and settings.smtp_password:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
