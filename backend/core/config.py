from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    SMS_API_KEY: str = ""
    SMS_SENDER: str = ""

    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    ENCRYPTION_KEY: str = ""  # Fernet key for encrypting report data

    ABSTRACT_API_KEY: str = ""  # AbstractAPI email validation key

    # Extra CORS origins for production (comma-separated). localhost is always allowed.
    ALLOWED_ORIGINS: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
