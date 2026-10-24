from app.config import settings
from app.services import email_service


class FakeSMTP:
    sent = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port = host, port

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.tls = True

    def login(self, user, password):
        self.creds = (user, password)

    def send_message(self, msg):
        FakeSMTP.sent.append((self, msg))


def test_smtp_used_when_configured(monkeypatch):
    FakeSMTP.sent.clear()
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(settings, "SMTP_USER", "sender@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "app-password")
    monkeypatch.setattr(settings, "SMTP_FROM", "")

    email_service.send_password_reset_email("user@example.com", "https://x/reset?token=abc")

    assert len(FakeSMTP.sent) == 1
    server, msg = FakeSMTP.sent[0]
    assert server.tls and server.creds == ("sender@gmail.com", "app-password")
    assert msg["To"] == "user@example.com"
    assert "sender@gmail.com" in msg["From"]
    assert "https://x/reset?token=abc" in msg.get_body(("plain",)).get_content()
    assert "https://x/reset?token=abc" in msg.get_body(("html",)).get_content()


def test_send_failure_never_raises(monkeypatch):
    class Boom(FakeSMTP):
        def login(self, *a):
            raise OSError("auth failed")

    monkeypatch.setattr(email_service.smtplib, "SMTP", Boom)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setattr(settings, "SMTP_USER", "sender@gmail.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "bad")
    email_service.send_password_reset_email("user@example.com", "https://x")  # must not raise
