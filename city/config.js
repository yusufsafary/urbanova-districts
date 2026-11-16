/* Urbanova Districts: public site configuration.
   Agents and this page read contract data from here only. Contracts
   deploy on BNB Chain (chain id 56) from the project wallet below;
   addresses are filled in here at deployment and verified on Sourcify.
   An empty address means: not deployed yet. Agents must stop when an
   address is empty or a zero address (see skill.md). */
window.URBANOVA_CONFIG = {
  CONTRACT: "", // UrbanovaPlots NFT (PLOT)
  TOKEN: "", // Urbanova token (URBN)
  CLAIM: "", // UrbanovaClaim (holder claim)
  CLAIM_FEE_WEI: "0", // base claim fee in BNB wei; Nova plots pay exactly 2x. Read claimFee() on chain for truth.
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
