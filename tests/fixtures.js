import { test as base, expect } from "@playwright/test";
// Each browser scenario gets a fresh request budget, without weakening or
// disabling the limiter configured for real traffic.
export const test = base.extend({
  requestBudget: [
    async ({ request }, use) => {
      const response = await request.post("/__test/reset-limits");
      expect(response.status()).toBe(204);
      await use();
    },
    { auto: true },
  ],
});
export { expect };
