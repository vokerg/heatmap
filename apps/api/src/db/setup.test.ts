import { describe, expect, it } from "vitest";
import {
  getDatabaseName,
  getMaintenanceUrl,
  quoteIdentifier,
} from "./setup.js";

describe("local database setup helpers", () => {
  it("uses the maintenance database while preserving connection credentials", () => {
    expect(
      getMaintenanceUrl(
        "postgresql://heatmap:secret@localhost:5432/activity_map?sslmode=disable",
      ),
    ).toBe(
      "postgresql://heatmap:secret@localhost:5432/postgres?sslmode=disable",
    );
  });

  it("extracts and safely quotes the configured database name", () => {
    expect(getDatabaseName("postgresql://localhost/my%20map")).toBe("my map");
    expect(quoteIdentifier('my"map')).toBe('"my""map"');
  });
});
