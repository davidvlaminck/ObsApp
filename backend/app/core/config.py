from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ObsApp"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    database_url: str = "postgresql://obsapp_user:obsapp_pass@localhost:5432/obsapp"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
