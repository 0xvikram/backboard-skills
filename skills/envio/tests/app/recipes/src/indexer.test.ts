// Not a skill block: a simulate test for recipe 4 (wildcard ERC20 Transfer with `where` on from = 0x0).
import { describe, it } from "vitest";
import { createTestIndexer } from "envio";

describe("ERC20 mints (recipe 4)", () => {
  it("stores a Mint for a transfer from the zero address on chain 130", async (t) => {
    const indexer = createTestIndexer();
    const to = "0x1111111111111111111111111111111111111111";
    await indexer.process({
      chains: {
        130: {
          simulate: [
            { contract: "ERC20", event: "Transfer", params: { from: "0x0000000000000000000000000000000000000000", to, value: 5n } },
          ],
        },
      },
    });
    const mints = await indexer.Mint.getAll();
    t.expect(mints.length).toBe(1);
    t.expect(mints[0]!.value).toBe(5n);
  });
});
