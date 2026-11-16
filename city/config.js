/* Urbanova Districts: public site configuration.
   Agents and this page read contract data from here only. Contracts
   deploy on BNB Chain (chain id 56) from the project wallet below;
   addresses are filled in here at deployment and verified on Sourcify.
   An empty address means: not deployed yet. Agents must stop when an
   address is empty or a zero address (see skill.md). */
window.URBANOVA_CONFIG = {
  CONTRACT: "0x02A9830b695229d0BcAa39d236778C257b87D85b", // UrbanovaPlots NFT (PLOT)
  TOKEN: "0x8409f4efebD02C548a96B4ECd295A7543c730B32", // Urbanova token (URBN)
  CLAIM: "0xdc647FbfCFA45Cf03E16c5C000f9266bf7911cfd", // UrbanovaClaim (holder claim)
  CLAIM_FEE_WEI: "352210943954062", // base claim fee in BNB wei; Nova plots pay exactly 2x. Read claimFee() on chain for truth.
  AGENT_ID_REGISTRY: "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F", // SPACE ID Agent ID registry
  PROJECT_WALLET: "0x2dBe74e1ef1B791e341f8aC045d5C31fAc65Cbc6",
  CHAIN_ID: 56,
  MAX_PER_DISTRICT: 10,
  RPCS: [
    "https://bsc-rpc.publicnode.com",
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.binance.org"
  ]
};
