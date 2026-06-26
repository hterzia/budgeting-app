/**
 * Integration tests for backend categorization pure functions.
 * No mocks — tests real function behavior.
 */
import { describe, it, expect } from "vitest";
import {
  buildTextForEmbedding,
  applyCategoryRules,
} from "../src/services/categorizeSqlite.js";

describe("buildTextForEmbedding", () => {
  it("generates embedding text with merchant and description", () => {
    const text = buildTextForEmbedding({
      merchantClean: "Starbucks",
      descriptionRaw: "Coffee purchase",
      amountCents: 550,
    });
    expect(text).toContain("Merchant: Starbucks");
    expect(text).toContain("Description: Coffee purchase");
    expect(text).toContain("Amount: small"); // 550 cents < 1000
    expect(text).toContain("Domain: coffee"); // Starbucks → coffee
  });

  it("classifies amount buckets correctly", () => {
    const small = buildTextForEmbedding({ merchantClean: "X", amountCents: 999 });
    expect(small).toContain("Amount: small");

    const medium = buildTextForEmbedding({ merchantClean: "X", amountCents: 1000 });
    expect(medium).toContain("Amount: medium");

    const mediumUpper = buildTextForEmbedding({ merchantClean: "X", amountCents: 9999 });
    expect(mediumUpper).toContain("Amount: medium");

    const large = buildTextForEmbedding({ merchantClean: "X", amountCents: 10000 });
    expect(large).toContain("Amount: large");
  });

  it("handles negative amountCents via Math.abs", () => {
    const text = buildTextForEmbedding({ merchantClean: "X", amountCents: -500 });
    expect(text).toContain("Amount: small"); // abs(500) < 1000
  });

  it("uses 'Unknown' when merchantClean is empty", () => {
    const text = buildTextForEmbedding({ merchantClean: "", amountCents: 100 });
    expect(text).toContain("Merchant: Unknown");
  });

  it("uses 'Unknown' when merchantClean is undefined", () => {
    const text = buildTextForEmbedding({ amountCents: 100 });
    expect(text).toContain("Merchant: Unknown");
  });

  it("handles empty descriptionRaw", () => {
    const text = buildTextForEmbedding({ merchantClean: "Store", amountCents: 100 });
    expect(text).toContain("Description: .");
  });

  it("extracts domain for known merchants", () => {
    const cases: { merchant: string; expectedDomain: string }[] = [
      { merchant: "Starbucks Reserve", expectedDomain: "coffee" },
      { merchant: "Dunkin Donuts", expectedDomain: "coffee" },
      { merchant: "Uber Eats", expectedDomain: "transport" },
      { merchant: "Amazon.com", expectedDomain: "shopping" },
      { merchant: "City Gym Fitness", expectedDomain: "fitness" },
      { merchant: "Hilton Hotel", expectedDomain: "travel" },
      { merchant: "CVS Pharmacy", expectedDomain: "health" },
      { merchant: "Electric Company", expectedDomain: "utilities" },
      { merchant: "Burger King", expectedDomain: "food" },
      { merchant: "Apartment Rent", expectedDomain: "housing" },
    ];

    for (const { merchant, expectedDomain } of cases) {
      const text = buildTextForEmbedding({ merchantClean: merchant, amountCents: 100 });
      expect(text).toContain(`Domain: ${expectedDomain}`);
    }
  });

  it("uses 'general' domain for unknown merchants", () => {
    const text = buildTextForEmbedding({ merchantClean: "XYZ Corp", amountCents: 100 });
    expect(text).toContain("Domain: general");
  });
});

describe("applyCategoryRules", () => {
  const rules = [
    { matchType: "merchant_clean", matchValue: "Starbucks", categoryId: "coffee", priority: 10 },
    { matchType: "contains", matchValue: "grocery", categoryId: "groceries", priority: 20 },
    { matchType: "regex", matchValue: "netflix|hulu|disney", categoryId: "entertainment", priority: 30 },
    { matchType: "merchant_clean", matchValue: "Shell Gas", categoryId: "gas", priority: 5 },
  ];

  it("matches exact merchant_clean (case-insensitive)", () => {
    const result = applyCategoryRules(
      { merchantClean: "Starbucks", descriptionRaw: "" },
      rules
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("coffee");
    expect(result!.confidence).toBe(0.98);
  });

  it("merchant_clean match is case-insensitive", () => {
    const result = applyCategoryRules(
      { merchantClean: "STARBUCKS", descriptionRaw: "" },
      rules
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("coffee");
  });

  it("matches contains rule", () => {
    const result = applyCategoryRules(
      { merchantClean: "Whole Foods Grocery", descriptionRaw: "" },
      rules
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("groceries");
  });

  it("matches regex rule on merchant", () => {
    const result = applyCategoryRules(
      { merchantClean: "Netflix Subscription", descriptionRaw: "" },
      rules
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("entertainment");
  });

  it("matches regex rule on description", () => {
    const result = applyCategoryRules(
      { merchantClean: "Unknown", descriptionRaw: "hulu monthly" },
      rules
    );
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("entertainment");
  });

  it("returns null when no rule matches", () => {
    const result = applyCategoryRules(
      { merchantClean: "Random Store", descriptionRaw: "some purchase" },
      rules
    );
    expect(result).toBeNull();
  });

  it("respects priority order — lower number wins", () => {
    // "Shell Gas Station" matches both 'contains: gas' (if existed) and 'merchant_clean: Shell Gas'
    // Shell Gas has priority 5, which is highest
    const result = applyCategoryRules(
      { merchantClean: "Shell Gas", descriptionRaw: "" },
      rules
    );
    expect(result!.categoryId).toBe("gas");
  });

  it("returns null for empty rules array", () => {
    const result = applyCategoryRules(
      { merchantClean: "Starbucks" },
      []
    );
    expect(result).toBeNull();
  });

  it("handles undefined merchantClean gracefully", () => {
    const result = applyCategoryRules(
      { descriptionRaw: "some purchase" },
      rules
    );
    // No merchant to match against merchant_clean or contains
    // regex could still match on description
    expect(result).toBeNull();
  });

  it("handles invalid regex gracefully", () => {
    const badRules = [
      { matchType: "regex", matchValue: "[invalid(regex", categoryId: "bad", priority: 1 },
    ];
    const result = applyCategoryRules(
      { merchantClean: "Test", descriptionRaw: "Test" },
      badRules
    );
    expect(result).toBeNull();
  });

  it("multiple rules with same priority — first match wins", () => {
    const samepriorityRules = [
      { matchType: "merchant_clean", matchValue: "Target", categoryId: "shopping", priority: 10 },
      { matchType: "contains", matchValue: "target", categoryId: "retail", priority: 10 },
    ];
    const result = applyCategoryRules(
      { merchantClean: "Target", descriptionRaw: "" },
      samepriorityRules
    );
    // Both match, but merchant_clean comes first in the sorted array (stable sort)
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("shopping");
  });
});
