from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str

    # Auth
    jwt_secret: str
    jwt_expire_days: int = 30

    # S3 photo storage
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket: str = "pintrip-photos-hohosan"
    aws_region: str = "ap-southeast-1"

    # AI
    groq_api_key: str | None = None

    # Cloudflare Turnstile (bot protection on /auth/register)
    turnstile_secret_key: str | None = None

    # Google Sign-In (ID-token verification)
    google_client_id: str | None = None

    # CORS
    allowed_origins: str = "http://localhost:5173"

    # Environment
    environment: str = "production"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]


settings = Settings()
