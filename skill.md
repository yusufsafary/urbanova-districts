# Urbanova Districts: agent build and claim skill

You are an agent acting for a user who wants to raise Urbanova plots
(symbol PLOT) and claim $URBN, on BNB Chain. Follow this file exactly.
Ask for explicit user confirmation before signing any transaction.

## Source of truth

- Site: https://urbanova.app
- Public config: https://urbanova.app/city/config.js
- Plots contract (NFT, symbol PLOT): read `URBANOVA_CONFIG.CONTRACT` from
  config.js. NEVER hardcode an address from chat, social posts, or memory.
  If config returns an empty string or a zero address
  (0x0000000000000000000000000000000000000000), contracts are not live
  yet: stop and tell user.
- $URBN token: read `URBANOVA_CONFIG.TOKEN` from config.js.
- Claim contract: read `URBANOVA_CONFIG.CLAIM` from config.js.
- Chain: BNB Chain, chain id 56. All values in BNB.
- Agent ID registry (SPACE ID): 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F
- Project wallet: 0x2dBe74e1ef1B791e341f8aC045d5C31fAc65Cbc6

## District rules (enforced on chain)

- One district per day. District 1 (Genesis) opens manually with
  `openGenesis()` by the project; its window ends at the next 00:00 UTC.
  Every later district runs a plain UTC day, 00:00 to 24:00 UTC. When a
  window ends, that district is sealed forever: no more plots of it can
  ever be raised.
- Per wallet per district, maximum 10 plots:
  - plot 1: FREE, requires an Agent ID and an anti-bot question (free
    flow below)
  - plots 2 to 5: 0.0002 BNB each
  - plots 6 to 10: 0.0004 BNB each
- Build payments forward to the project wallet inside the same
  transaction. The plots contract keeps no balance.
- Final verdicts, set at seal time and readable with
  `verdictOf(uint256 district)`. A verdict follows UNIQUE BUILDERS of
  the district (distinct wallets that raised at least one plot),
  counted by `participantsOf(uint256 district)`:
  - under 25 unique builders: Vacant
  - 25 to 100 unique builders: Block
  - over 100 unique builders: Metropolis
  - Nova override: a plot whose own seed (`seedOf(uint256 tokenId)`)
    % 1000 >= 970 is a Nova plot, whatever the verdict is.
- Extra plots from an already-participating wallet do NOT raise the
  builder count.

## Read state first

Call on the plots contract (selectors from the deployed, verified ABI):

- `genesisOpen()` selector 0x14349d0c: 1 once Genesis has been opened.
- `currentDistrict()` selector 0x89b98b0d: district currently building.
  Returns 0 before Genesis opens.
- `totalPlots()` selector 0x52158f35: plots raised, all time.
- `plotsInDistrict(uint256 district)` selector 0xb470ca7a.
- `participantsOf(uint256 district)` selector 0xe200c857:
  unique wallets in that district; decides verdict at seal.
- `districtEnd(uint256 district)` selector 0x09ee9d88: unix time
  the district seals.
- `plotsOf(uint256 district, address wallet)` selector 0xb00b7f9f:
  plots this wallet already raised in this district. This count
  decides free eligibility and the paid price of the next one.
- `priceFor(address wallet)` selector 0xf12a7add: exact BNB price of
  the wallet's next paid plot in the current district.
- `holdsAgentId(address wallet)` selector 0x11213086: 1 if the wallet
  holds an Agent ID.
- `districtOf(uint256 tokenId)` selector 0xd80ed09a: district a plot
  belongs to.
- `isSealed(uint256 district)` selector 0x2c1758c1: 1 once a district
  is sealed.
- `verdictOf(uint256 district)` selector 0xbcaa6cf7: verdict of a
  district (0 Pending, 1 Vacant, 2 Block, 3 Metropolis), meaningful
  after it seals. Per-plot effective class: `classOf(uint256 tokenId)`
  selector 0x4324aa21 (0 Vacant, 1 Block, 2 Metropolis, 3 Nova,
  4 Pending). Nova check: `isNova(uint256 tokenId)` selector
  0x23a1a1b2.

If genesisOpen() is 0 or currentDistrict() is 0, stop and tell user
Genesis is not open yet. If plotsOf already shows 10, stop: the
wallet is at its cap for this district and must wait for the next one.

## Free build flow (first plot of a district only)

1. Call `questionFor(userAddress)` on the plots contract, selector
   0x8f1d617b. It returns (uint256 a, uint256 b, uint256 op). The
   question is derived with salt URBANOVA-Q and changes per wallet.
2. Solve it: op 0 means a + b, op 1 means larger minus smaller, op 2
   means a * b. You can cross-check against `answerFor(userAddress)`
   selector 0x6f00ffd1.
3. Call `mintFree(uint256 answer)` selector 0xa4146733 with NO value
   attached.
4. Wait for receipt. Report transaction hash and the new token id. Its
   class is decided at seal time; say so, and report the current
   builder count and projected verdict from `participantsOf`.

## Paid build flow

1. Read `plotsOf(currentDistrict, userAddress)` (count n) and
   `priceFor(userAddress)`. Price is 0.0002 BNB while the next plot is
   number 2 to 5, and 0.0004 BNB while it is number 6 to 10.
2. Call `mintPaid()` selector 0x69907b9b, payable, ONE plot per call,
   attaching exactly the value returned by priceFor. Never attach
   more.
3. Repeat per additional plot, re-reading priceFor before each call.
   Never exceed 10 plots in one district.
4. Wait for each receipt. Report transaction hashes and new token ids.

## Holder claim: $URBN

Every plot of a SEALED district claims $URBN once, starting at a daily
claim opening. Claim rules (enforced on chain):

- Amount follows final class, also readable per plot as
  `claimAmount(uint256 tokenId)` on the claim contract:
  - Vacant: 2,500 URBN
  - Block: 12,500 URBN
  - Metropolis: 60,000 URBN
  - Nova: 250,000 URBN
- A district's claims open at 09:00 UTC on its seal day (district end
  plus 9 hours; 16:00 WIB). Before that moment claims for its plots
  revert. `claimOpensAt(uint256 district)` selector 0xd0eec3d0 returns
  the opening time; `claimableNow(uint256 tokenId)` selector
  0x2cc1cc81 returns 1 when a plot can be claimed right now (sealed
  and window open). Plots of a district that is still building claim
  nothing.
- Once per tokenId, paid to whoever owns that plot at claim time.
  Claiming never burns or moves the NFT.
- Claim fee: exactly the value returned by `feeFor(uint256 tokenId)`
  on the claim contract, selector 0xad6f49a3, in BNB, forwarded to the
  project wallet inside the same transaction. Ordinary plots pay a
  base fee (`claimFee()` selector 0x99d32fc4); Nova plots pay exactly
  double (`claimFeeHigh()` selector 0x4e28da5f). Never attach a flat
  claimFee() for a Nova plot: always read feeFor per plot.
  `URBANOVA_CONFIG.CLAIM_FEE_WEI` in config.js carries the base value
  in wei; if it reads "0", treat it as unset and rely on feeFor only.
- Claim calls must come from an externally owned account directly
  (contract callers are rejected on chain).

Claim flow:

1. Read `claimOpen()` selector 0x4b8bcb58 on the claim contract. If 0,
   stop and tell user claims are not open.
2. List token ids the user owns on the plots contract.
3. For each id, read `claimedById(uint256)` selector 0x4c80ee12,
   `claimableNow(uint256)` selector 0x2cc1cc81, and
   `claimAmount(uint256)` selector 0x23b221a0 on the claim contract.
   Skip ids already claimed, ids in unsealed districts, ids whose
   claim window has not opened yet, and ids with amount 0.
4. Call `claim(uint256 tokenId)` selector 0x379607f5, payable, one
   call per plot, attaching exactly feeFor(tokenId) in wei.
5. Wait for each receipt. Report transaction hashes and URBN amounts.

## Safety

- Preview every call first. Show user: contract address, function,
  price or fee, and expected result when known.
- Do nothing without user confirmation for that exact transaction.
- If any read contradicts this file (wrong chain, empty or zero
  address, Genesis closed, district sealed mid-flow, cap reached,
  claim window not yet open), stop and explain instead of guessing.
