// Bridge configuration for Sepolia to CELO
// Based on Optimism Standard Bridge documentation
// Token addresses are entered manually by users

export const BRIDGE_CONFIG = {
  sepoliaToCelo: {
    l1ChainId: 11155111, // Sepolia
    l2ChainId: 11142220, // CELO Mainnet
  },
};

export type BridgeName = keyof typeof BRIDGE_CONFIG;

export function getBridgeConfig(bridgeName: BridgeName) {
  return BRIDGE_CONFIG[bridgeName];
}
