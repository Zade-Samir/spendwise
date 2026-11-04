# SpendWise — Known Issues, Technical Debt & Platform Constraints

This document tracks verified platform constraints, architectural trade-offs, and future technical debt items for SpendWise.

---

## 1. Active Platform-Specific Constraints

### 1.1 iOS WebKit Sandboxing & Payment App Isolation
- **Classification:** Operating System / Platform Constraint (Permanent)
- **Detail:** Apple iOS strictly isolates applications within WebKit and sandbox containers. A web application (including an installed PWA) has zero access to incoming SMS messages, system notifications, or transaction histories of third-party apps such as Google Pay, PhonePe, or Paytm.
- **Impact:** SpendWise cannot autonomously intercept or log UPI payments in the background without user interaction.
- **Mitigation:** Transparent UX copy, iOS Personal Automation opening `/add?source=shortcut`, URL parameter prefilling, and personal API tokens for headless Shortcut logging.

### 1.2 Apple iOS PWA Installation & Push Requirements
- **Classification:** Platform Constraint (Permanent)
- **Detail:** 
  1. iOS Safari does not support the `beforeinstallprompt` event. Installation must be guided through manual user action ("Share → Add to Home Screen").
  2. Web Push notifications on iOS are supported only on iOS / iPadOS 16.4 or later, and **only** after the app is added to the Home Screen and launched in standalone mode.
  3. Permission must be requested following an explicit user gesture (button tap).
- **Mitigation:** In-app install banner explaining the two-tap Home Screen addition; in-app notification banner fallbacks for users on unsupported iOS versions or standard browser tabs.

### 1.3 Safari Lack of W3C Background Sync API
- **Classification:** Browser Feature Gap (Active)
- **Detail:** Apple Safari does not implement the standard Service Worker `sync` event (Background Sync).
- **Impact:** Background synchronization cannot fire automatically when the device regains network if the PWA is completely terminated.
- **Mitigation:** SpendWise binds sync triggers to multiple complementary events: `window.addEventListener('online')`, document `visibilitychange` (app foregrounded), and cold application launch.

---

## 2. v1 Architectural Limitations & Scope Boundaries

### 2.1 Offline Operation Scope (Creation Only)
- **Detail:** In v1, offline support is strictly limited to transaction **creation** via the IndexedDB queue.
- **Limitation:** Editing or deleting existing transactions requires an active network connection.
- **Reasoning:** Prevents complex multi-master synchronization conflicts, clock-drift resolution, and vector clock overhead in v1.
- **UX Handling:** Attempting to edit or delete while offline surfaces a clear, polite explanation: *"Connect to the internet to edit or delete existing expenses"*.

### 2.2 In-Process Background Scheduler Scaling
- **Detail:** APScheduler runs in-process inside the FastAPI ASGI lifespan using `AsyncIOScheduler`.
- **Limitation:** If the backend is horizontally scaled across multiple container instances in the future, scheduled jobs (hourly recurring checks and 15-minute reminders) would run concurrently on each instance, causing redundant evaluations.
- **Mitigation:** The current single-node deployment satisfies all v1 performance and scale requirements. For future horizontal clustering (Phase 4), database distributed advisory locks (`pg_advisory_lock`) or Redis will be introduced via an ADR.

### 2.3 Single Currency Accounting
- **Detail:** SpendWise v1 is exclusively optimized for the Indian Rupee (INR ₹) and integer paise arithmetic.
- **Limitation:** Multi-currency conversions and foreign exchange rates are not supported in v1.

---

## 3. Verified Application Bugs

*No software bugs are recorded at this time, as application source code development has not yet commenced.*
