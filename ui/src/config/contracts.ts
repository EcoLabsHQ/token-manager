// Factory addresses deployed on different chains
export const CONTRACTS = {
  L1_TOKEN_FACTORY: {
    address: '0xFe6C8d1AB833Aa30933BbCBf3a19Ef1fB924444c',
    chainId: 11155111, // Sepolia
    name: 'L1TokenFactory',
  },
  L2_SUPERCHAIN_TOKEN_FACTORY: {
    address: '0x075FA6A9f0090ce4D9Cf7F35c2050B2DEe326292',
    chainId: 44787, // Celo Sepolia (Alfajores)
    name: 'L2SuperChainTokenFactory',
  },
} as const;

// ABI for L1TokenFactory
export const L1_TOKEN_FACTORY_ABI = [
  {
    name: 'createToken',
    type: 'function',
    inputs: [
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'initialSupply_', type: 'uint256' },
      { name: 'owner_', type: 'address' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'initialSupply', type: 'uint256' },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    name: 'getAllTokens',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getAllTokensCount',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ABI for L2SuperChainTokenFactory
export const L2_SUPERCHAIN_TOKEN_FACTORY_ABI = [
  {
    name: 'createToken',
    type: 'function',
    inputs: [
      { name: 'owner_', type: 'address' },
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'decimals_', type: 'uint8' },
      { name: 'maxSupply_', type: 'uint256' },
      { name: 'salt_', type: 'bytes' },
    ],
    outputs: [{ name: 'tokenAddress', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'TokenCreated',
    type: 'event',
    inputs: [
      { name: 'tokenAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'decimals', type: 'uint8' },
      { name: 'maxSupply', type: 'uint256' },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
  {
    name: 'getAllTokens',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getAllTokensCount',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
