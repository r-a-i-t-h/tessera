// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { WCBase } from "./index.js";

describe("WCBase", () => {
  it("derives observed attributes and dispatches their handlers", () => {
    class ExampleElement extends WCBase {
      static a = {
        label(this: ExampleElement, value: string | null) {
          this.textContent = value;
        },
      };
    }
    customElements.define("test-wc-base-attribute", ExampleElement);
    const element = document.createElement("test-wc-base-attribute") as ExampleElement;
    expect(ExampleElement.observedAttributes).toEqual(["label"]);
    element.setAttribute("label", "Hello");
    expect(element.textContent).toBe("Hello");
  });

  it("builds nested element arrays and rejects children without a parent", () => {
    class StructureElement extends WCBase {}
    customElements.define("test-wc-base-structure", StructureElement);
    const element = document.createElement("test-wc-base-structure") as StructureElement;
    const section = document.createElement("section");
    const paragraph = document.createElement("p");
    element.processElements(element, [section, [paragraph]]);
    expect(element.querySelector("section > p")).toBe(paragraph);
    expect(() => element.processElements(element, [[paragraph]])).toThrow(/Missing parent/);
  });
});
