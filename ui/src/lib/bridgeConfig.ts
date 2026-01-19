// Bridge configuration for Sepolia to Celo Sepolia
// Based on Optimism Standard Bridge documentation
// Token addresses are entered manually by users

export const BRIDGE_CONFIG = {
  sepoliaToCeloSepolia: {
    l1ChainId: 11155111, // Sepolia
    l2ChainId: 44787, // Celo Sepolia (Alfajores)
  },
};

export type BridgeName = keyof typeof BRIDGE_CONFIG;

export function getBridgeConfig(bridgeName: BridgeName) {
  return BRIDGE_CONFIG[bridgeName];
}
