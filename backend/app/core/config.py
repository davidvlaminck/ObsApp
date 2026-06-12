from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "ObsApp"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    database_url: str = "postgresql://obsapp_user:obsapp_pass@localhost:5432/obsapp"
    smtp_host: str = ""
    smtp_port: int = 2525
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@obsapp.test"
    frontend_base_url: str = "http://localhost:5173"
    activation_token_expire_hours: int = 48

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    def model_post_init(self, __context):
        if self.database_url.startswith("sqlite:///") and not self.database_url.startswith("sqlite:////"):
            relative_path = self.database_url.removeprefix("sqlite:///")
            self.database_url = f"sqlite:///{(BASE_DIR / relative_path).resolve()}"


settings = Settings()
