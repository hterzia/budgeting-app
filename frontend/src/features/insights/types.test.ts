import { describe, it, expect } from "vitest";
import { AggregationOptions, WidgetDefinition, WidgetInstance, TemplateName } from "./types";
import { presetSelection } from "../date-range/model/dateRange";

describe("insights types", () => {
  describe("AggregationOptions", () => {
    it("should have optional bounds property", () => {
      const options: AggregationOptions = {};
      expect(options.bounds).toBeUndefined();
    });

    it("should have optional categories array", () => {
      const options: AggregationOptions = { categories: ["cat-1", "cat-2"] };
      expect(options.categories).toEqual(["cat-1", "cat-2"]);
    });

    it("should have optional accounts array", () => {
      const options: AggregationOptions = { accounts: ["acct-1"] };
      expect(options.accounts).toEqual(["acct-1"]);
    });

    it("should have optional types array", () => {
      const options: AggregationOptions = { types: ["income", "expense"] };
      expect(options.types).toEqual(["income", "expense"]);
    });

    it("should have excludeIgnored defaulting to true", () => {
      const options: AggregationOptions = {};
      expect(options.excludeIgnored).toBeUndefined();
    });

    it("should have optional limit", () => {
      const options: AggregationOptions = { limit: 10 };
      expect(options.limit).toBe(10);
    });

    it("should have optional bucketSize", () => {
      const options: AggregationOptions = { bucketSize: 25 };
      expect(options.bucketSize).toBe(25);
    });

    it("should have optional mode", () => {
      const options1: AggregationOptions = { mode: "calendar" };
      const options2: AggregationOptions = { mode: "running" };
      expect(options1.mode).toBe("calendar");
      expect(options2.mode).toBe("running");
    });
  });

  describe("TemplateName", () => {
    it("should be one of the allowed values", () => {
      const templates: TemplateName[] = ["line", "bar", "pie", "summary"];
      expect(templates).toEqual(["line", "bar", "pie", "summary"]);
    });
  });

  describe("WidgetDefinition", () => {
    it("should have type, label, description, template, aggregate, display, defaultFilters", () => {
      const definition: WidgetDefinition = {
        type: "test",
        label: "Test Widget",
        description: "A test widget",
        template: "line",
        aggregate: () => [],
        display: {},
        defaultFilters: { dateRange: presetSelection("30days") },
      };
      expect(definition.type).toBe("test");
      expect(definition.label).toBe("Test Widget");
      expect(definition.description).toBe("A test widget");
      expect(definition.template).toBe("line");
      expect(typeof definition.aggregate).toBe("function");
      expect(definition.display).toEqual({});
      expect(definition.defaultFilters).toEqual({ dateRange: presetSelection("30days") });
    });

    it("should have optional aggregationDefaults", () => {
      const definition: WidgetDefinition = {
        type: "test",
        label: "Test",
        description: "Test",
        template: "line",
        aggregate: () => [],
        display: {},
        defaultFilters: { dateRange: presetSelection("30days") },
        aggregationDefaults: { limit: 10 },
      };
      expect(definition.aggregationDefaults).toEqual({ limit: 10 });
    });

    it("should have optional title in display", () => {
      const definition: WidgetDefinition = {
        type: "test",
        label: "Test",
        description: "Test",
        template: "bar",
        aggregate: () => [],
        display: { xAxisKey: "category" },
        defaultFilters: { dateRange: presetSelection("30days") },
      };
      expect(definition.display.xAxisKey).toBe("category");
    });
  });

  describe("WidgetInstance", () => {
    it("should have id and type", () => {
      const instance: WidgetInstance = {
        id: "widget-1",
        type: "cashflow",
      };
      expect(instance.id).toBe("widget-1");
      expect(instance.type).toBe("cashflow");
    });

    it("should have optional title", () => {
      const instance: WidgetInstance = {
        id: "widget-1",
        type: "cashflow",
        title: "My Cash Flow",
      };
      expect(instance.title).toBe("My Cash Flow");
    });

    it("should have optional filters", () => {
      const instance: WidgetInstance = {
        id: "widget-1",
        type: "cashflow",
        filters: {
          dateRange: presetSelection("90days"),
          categories: ["cat-1"],
          accounts: ["acct-1"],
          types: ["income"],
        },
      };
      expect(instance.filters?.dateRange).toEqual(presetSelection("90days"));
      expect(instance.filters?.categories).toEqual(["cat-1"]);
      expect(instance.filters?.accounts).toEqual(["acct-1"]);
      expect(instance.filters?.types).toEqual(["income"]);
    });
  });
});
