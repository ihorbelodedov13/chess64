from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dev_mode: bool = True
    api_key: str
    bot_token: str = ""  # Telegram Bot Token — required in production (DEV_MODE=false)
    database_url: str = "sqlite+aiosqlite:///./chess.db"
    default_time_base: int = 600
    default_time_increment: int = 0

    class Config:
        env_file = ".env"


settings = Settings()
