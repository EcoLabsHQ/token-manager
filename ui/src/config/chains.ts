import { celo } from 'viem/chains';

/**
 * Celo chain extended with OP Stack contract addresses on Ethereum Mainnet.
 *
 * These addresses are required by @eth-optimism/viem functions such as
 * getWithdrawalStatus, waitToProve, waitToFinalize, finalizeWithdrawal, etc.
 *
 * Source: https://docs.celo.org/cel2/l1-contracts
 */
export const celoOpStack = {
  ...celo,
  contracts: {
    ...celo.contracts,
    // OP Stack L1 contracts keyed by the L1 chain ID (Ethereum Mainnet = 1)
    portal: {
      1: {
        address: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC' as const,
      },
    },
    disputeGameFactory: {
      1: {
        address: '0xFbAC162162f4009Bb007C6DeBC36B1dAC10aF683' as const,
      },
    },
    l1StandardBridge: {
      1: {
        address: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe' as const,
      },
    },
    l1CrossDomainMessenger: {
      1: {
        address: '0x1AC1181fc4e4F877963680587AEAa2C90D7EbB95' as const,
      },
    },
  },
} as const;

/**
 * Correct mainnet OP Stack bridge addresses for Celo L2.
 * Source: https://docs.celo.org/cel2/l1-contracts
 */
export const CELO_BRIDGE_ADDRESSES = {
  /** L1StandardBridgeProxy on Ethereum Mainnet */
  L1_STANDARD_BRIDGE: '0x9C4955b92F34148dbcfDCD82e9c9eCe5CF2badfe' as const,
  /** L2StandardBridge predeploy on Celo */
  L2_STANDARD_BRIDGE: '0x4200000000000000000000000000000000000010' as const,
  /** OptimismPortalProxy on Ethereum Mainnet */
  OPTIMISM_PORTAL: '0xc5c5D157928BDBD2ACf6d0777626b6C75a9EAEDC' as const,
} as const;
