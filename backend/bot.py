"""
Telegram Bot — Chess Mini App launcher.

Commands:
  /start  — send a button to open the Mini App
  /help   — show help

Environment variables:
  BOT_TOKEN   — Telegram Bot token from @BotFather
  WEBAPP_URL  — Public HTTPS URL of the frontend (e.g. https://chess.example.com)
"""
import asyncio
import logging
import os

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


BOT_TOKEN = os.environ["BOT_TOKEN"]
WEBAPP_URL = os.environ.get("WEBAPP_URL", "http://localhost")


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    name = user.first_name if user else "игрок"

    # /start <game_id>  — invite link from a friend
    if context.args:
        game_id = context.args[0]
        join_url = f"{WEBAPP_URL}/?startapp={game_id}"
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton(
                text="♟ Вступить в игру",
                web_app=WebAppInfo(url=join_url),
            )],
        ])
        await update.message.reply_text(
            f"{name}, тебя приглашают сыграть в шахматы! ♟\n\n"
            "Нажми кнопку ниже, чтобы сразу присоединиться к партии.",
            reply_markup=keyboard,
        )
        return

    # Regular /start — open the app
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(
            text="♟ Играть в шахматы",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )],
    ])
    await update.message.reply_text(
        f"Привет, {name}! 👋\n\n"
        "Нажми кнопку ниже чтобы открыть игру прямо в Telegram.",
        reply_markup=keyboard,
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "♟ *Шахматы* — Mini App\n\n"
        "Команды:\n"
        "  /start — открыть игру\n"
        "  /help  — это сообщение",
        parse_mode="Markdown",
    )


def main() -> None:
    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .build()
    )

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))

    logger.info("Bot started. WEBAPP_URL=%s", WEBAPP_URL)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
