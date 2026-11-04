import { test, expect } from '@playwright/test';

test.describe('SpendWise Critical User Journey (Mobile Safari)', () => {
  const randomSuffix = Math.floor(Math.random() * 100000);
  const testEmail = `playwright_${randomSuffix}@spendwise.app`;
  const testPassword = 'Password123!';

  test('Registration, Quick Add with Keypad, Dashboard Reconcile & Navigation', async ({ page }) => {
    // 1. Visit App
    await page.goto('/login');

    // 2. Navigate to Register
    const registerLink = page.getByRole('link', { name: /create an account|register/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
    } else {
      await page.goto('/register');
    }

    // 3. Fill registration form
    await page.getByPlaceholder(/name/i).fill('Mobile Tester');
    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).first().fill(testPassword);
    await page.getByRole('button', { name: /sign up|create account|register/i }).click();

    // 4. Verify redirected to Dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/SpendWise/i)).toBeVisible();

    // 5. Navigate to Quick Add
    await page.getByLabel('Add expense').click();
    await expect(page).toHaveURL('/add');

    // 6. Enter amount using numeric keypad: ₹250
    await page.getByRole('button', { name: '2' }).click();
    await page.getByRole('button', { name: '5' }).click();
    await page.getByRole('button', { name: '0' }).click();

    // Select category chip if visible
    const foodChip = page.getByText(/Food & Dining/i).first();
    if (await foodChip.isVisible()) {
      await foodChip.click();
    }

    // Save expense (<= 3 taps requirement)
    await page.getByRole('button', { name: /Save Expense/i }).click();

    // 7. Verify back on dashboard and totals updated
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/250/i)).toBeVisible();

    // 8. Navigate to History (Transactions)
    await page.getByRole('link', { name: /History/i }).click();
    await expect(page).toHaveURL('/transactions');
    await expect(page.getByText(/Food & Dining/i)).toBeVisible();

    // 9. Navigate to Settings & verify theme toggle and shortcuts
    await page.getByRole('link', { name: /More/i }).click();
    await page.getByRole('link', { name: /Settings/i }).click();
    await expect(page.getByText(/Settings & Preferences/i)).toBeVisible();
    await expect(page.getByText(/iOS Shortcuts & API Tokens/i)).toBeVisible();
  });
});

