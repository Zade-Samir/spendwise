import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler  # type: ignore[import-untyped]

from app.core.db import AsyncSessionLocal
from app.services.recurring import RecurringService
from app.services.reminders import ReminderService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def execute_recurring_auto_create() -> None:
    """Executes scheduled check for auto_create recurring expenses."""
    try:
        async with AsyncSessionLocal() as session:
            count = await RecurringService.process_auto_create_rules(session)
            if count > 0:
                logger.info("Recurring job: auto-created %d transaction(s)", count)
    except Exception as e:
        logger.error("Error executing recurring auto-create job: %s", e, exc_info=True)


async def execute_daily_reminders() -> None:
    """Executes scheduled 15-minute evaluation for daily expense reminders."""
    try:
        async with AsyncSessionLocal() as session:
            count = await ReminderService.evaluate_daily_reminders(session)
            if count > 0:
                logger.info("Reminder job: dispatched %d daily reminder(s)", count)
    except Exception as e:
        logger.error("Error executing daily reminder job: %s", e, exc_info=True)


def start_scheduler() -> None:
    """Starts the APScheduler for recurring and notification background tasks."""
    if not scheduler.running:
        scheduler.add_job(
            execute_recurring_auto_create,
            trigger="interval",
            hours=1,
            id="recurring_auto_create",
            replace_existing=True,
        )
        scheduler.add_job(
            execute_daily_reminders,
            trigger="interval",
            minutes=15,
            id="daily_reminders",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("APScheduler started: recurring (hourly) and reminder (15-min) jobs registered")


def stop_scheduler() -> None:
    """Stops the APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
