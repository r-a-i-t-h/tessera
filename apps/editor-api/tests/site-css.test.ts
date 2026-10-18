import { describe, expect, it } from "vitest";
import { stripLegacyContentHeadingRules } from "../src/site/site-css.js";

describe("stripLegacyContentHeadingRules", () => {
  it("removes legacy #content heading blocks and keeps the rest", () => {
    const css = `#content {
  font-size: 120%;
}

#content h2 {
  clear: right;
  margin: 20px 0 8px;
  border-bottom: dashed 1px #ddd;
}

#content p {
  margin-top: 0;
}
`;
    expect(stripLegacyContentHeadingRules(css)).toBe(`#content {
  font-size: 120%;
}

#content p {
  margin-top: 0;
}
`);
  });
});
