from enum import StrEnum


class PaymentMethod(StrEnum):
    UPI = "upi"
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    OTHER = "other"


class TxnSource(StrEnum):
    MANUAL = "manual"
    SHORTCUT = "shortcut"
    CSV_IMPORT = "csv_import"
    RECURRING = "recurring"


class BudgetPeriod(StrEnum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class RecurFreq(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class RecurMode(StrEnum):
    AUTO_CREATE = "auto_create"
    REMIND = "remind"


class ImportStatus(StrEnum):
    UPLOADED = "uploaded"
    MAPPED = "mapped"
    COMMITTED = "committed"
    FAILED = "failed"


class AccountType(StrEnum):
    CASH = "cash"
    BANK = "bank"
    CARD = "card"
    WALLET = "wallet"
