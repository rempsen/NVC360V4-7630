import { describe, it, expect } from "bun:test";
import { buildUnitLineItem, sumLineItems, sumUnitLinePay, type LineItem } from "../catalog";

describe("buildUnitLineItem", () => {
  it("computes charge (price) and tech pay (cost) from per-unit rates", () => {
    const li = buildUnitLineItem({ name: "LVP install", unit: "sq/ft", qty: 1500, unitPrice: 2.0, unitPayRate: 1.2 });
    expect(li.kind).toBe("unit");
    expect(li.price).toBe(3000); // 1500 * 2.00 customer charge
    expect(li.cost).toBe(1800);  // 1500 * 1.20 tech pay
    expect(li.unitPrice).toBe(2.0);
    expect(li.unitCost).toBe(1.2);
  });

  it("supports pay-only lines (zero customer charge)", () => {
    const li = buildUnitLineItem({ name: "Haul-away", unit: "each", qty: 3, unitPrice: 0, unitPayRate: 25 });
    expect(li.price).toBe(0);
    expect(li.cost).toBe(75);
  });

  it("rounds to cents", () => {
    const li = buildUnitLineItem({ name: "Carpet", unit: "sq/yd", qty: 7, unitPrice: 6.005, unitPayRate: 0 });
    expect(li.price).toBe(42.04);
  });
});

describe("sumLineItems with unit lines", () => {
  it("rolls unit charges into price and unit pay into cost; margin = charge - pay", () => {
    const lines: LineItem[] = [
      buildUnitLineItem({ name: "LVP install", unit: "sq/ft", qty: 1500, unitPrice: 2.0, unitPayRate: 1.2 }),
      buildUnitLineItem({ name: "Carpet tile install", unit: "sq/yd", qty: 500, unitPrice: 6.0, unitPayRate: 4.0 }),
    ];
    const t = sumLineItems(lines);
    expect(t.price).toBe(6000); // 3000 + 3000 customer charge
    expect(t.cost).toBe(3800);  // 1800 + 2000 tech pay
    expect(t.margin).toBe(2200);
  });

  it("respects taxable flag", () => {
    const lines: LineItem[] = [
      buildUnitLineItem({ name: "Taxable", unit: "each", qty: 10, unitPrice: 5, unitPayRate: 0, taxable: true }),
      buildUnitLineItem({ name: "Exempt", unit: "each", qty: 10, unitPrice: 5, unitPayRate: 0, taxable: false }),
    ];
    const t = sumLineItems(lines);
    expect(t.price).toBe(100);
    expect(t.taxablePrice).toBe(50);
  });
});

describe("sumUnitLinePay", () => {
  it("totals only unit-line tech pay, ignoring catalog lines", () => {
    const lines: LineItem[] = [
      buildUnitLineItem({ name: "Install", unit: "sq/ft", qty: 100, unitPrice: 2, unitPayRate: 1 }),
      // a fake catalog line — sumUnitLinePay must ignore it
      { itemId: "c1", kind: "product", name: "Box", sku: "", unit: "each", qty: 2, unitCost: 5, unitPrice: 9, taxable: true, cost: 10, price: 18 },
    ];
    expect(sumUnitLinePay(lines)).toBe(100); // only the unit line's pay
  });
});
