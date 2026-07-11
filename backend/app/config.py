from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str

    # Auth
    jwt_secret: str
    jwt_expire_days: int = 30

    # Supabase (still used for places/photos DB queries and storage until RDS+S3 migration)
    supabase_url: str = ""
    supabase_service_key: str = ""

    # AI
    groq_api_key: str | None = None

    # CORS
    allowed_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]


settings = Settings()
