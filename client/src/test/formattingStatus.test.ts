import * as assert from "assert";

import { withFormattingStatus } from "../formattingStatus";

suite("Formatting status middleware", () => {
  test("marks status as normal when formatting returns edits", async () => {
    const calls: string[] = [];

    const result = await withFormattingStatus(async () => ["edit"], {
      showNormal: () => calls.push("normal"),
      showError: () => calls.push("error"),
    });

    assert.deepStrictEqual(result, ["edit"]);
    assert.deepStrictEqual(calls, ["normal"]);
  });

  test("does not change status when formatting resolves to null", async () => {
    const calls: string[] = [];

    const result = await withFormattingStatus(async () => null, {
      showNormal: () => calls.push("normal"),
      showError: () => calls.push("error"),
    });

    assert.strictEqual(result, null);
    assert.deepStrictEqual(calls, []);
  });

  test("marks status as error when formatting throws", async () => {
    const calls: string[] = [];

    await assert.rejects(
      withFormattingStatus(
        async () => {
          throw new Error("format failed");
        },
        {
          showNormal: () => calls.push("normal"),
          showError: () => calls.push("error"),
        },
      ),
      /format failed/,
    );

    assert.deepStrictEqual(calls, ["error"]);
  });

  test("ignores canceled requests", async () => {
    const calls: string[] = [];
    const error = new Error("canceled");
    error.name = "Canceled";

    await assert.rejects(
      withFormattingStatus(
        async () => {
          throw error;
        },
        {
          showNormal: () => calls.push("normal"),
          showError: () => calls.push("error"),
        },
      ),
      (thrown: unknown) => thrown === error,
    );

    assert.deepStrictEqual(calls, []);
  });
});
