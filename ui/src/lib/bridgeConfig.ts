// Bridge configuration for Ethereum to Celo Mainnet
// Based on Optimism Standard Bridge documentation
// Token addresses are entered manually by users

export const BRIDGE_CONFIG = {
  ethereumToCelo: {
    l1ChainId: 1, // Ethereum Mainnet
    l2ChainId: 42220, // Celo Mainnet
  },
};

export type BridgeName = keyof typeof BRIDGE_CONFIG;

export function getBridgeConfig(bridgeName: BridgeName) {
  return BRIDGE_CONFIG[bridgeName];
}
