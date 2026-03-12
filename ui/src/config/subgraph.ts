export const SUBGRAPH_URLS = {
  ethereum:
    'https://api.studio.thegraph.com/query/72352/minter-ethereum/version/latest',
  celo: 'https://api.studio.thegraph.com/query/72352/minter-celo/version/latest',
} as const;

export const QUERIES = {
  // Obtener tokens L1 creados por un usuario
  getL1TokensByOwner: `
    query GetL1TokensByOwner($owner: Bytes!) {
      tokens(where: { owner: $owner }) {
        id
        tokenAddress
        owner
        name
        symbol
        decimals
        initialSupply
        maxSupply
        chain
        createdAt
        
      }
    }
  `,

  // Obtener tokens L2 creados por un usuario (incluye remoteToken para conectar con L1)
  getL2TokensByOwner: `
    query GetL2TokensByOwner($owner: Bytes!) {
      tokens(where: { owner: $owner }) {
        id
        tokenAddress
        owner
        name
        symbol
        decimals
        initialSupply
        maxSupply
        chain
        remoteToken
        bridge
        createdAt
        totalUniqueHolders
      }
    }
  `,

  // Buscar tokens L2 por sus remoteTokens (L1 addresses)
  getL2TokensByRemoteTokens: `
    query GetL2TokensByRemoteTokens($remoteTokens: [Bytes!]!) {
      tokens(where: { remoteToken_in: $remoteTokens }) {
        id
        tokenAddress
        owner
        name
        symbol
        decimals
        initialSupply
        maxSupply
        chain
        remoteToken
        bridge
        createdAt
        totalUniqueHolders
      }
    }
  `,

  // Obtener todos los tokens L1 (sin filtro de owner)
  getAllL1Tokens: `
    query GetAllL1Tokens($first: Int!, $skip: Int!) {
      tokens(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
        id
        tokenAddress
        owner
        name
        symbol
        decimals
        initialSupply
        maxSupply
        totalSupply
        totalUniqueHolders
        totalTransfers
        totalBridges
        chain
        createdAt
      }
    }
  `,

  // Obtener todos los tokens L2 (sin filtro de owner), ordenados por totalSupply
  getAllL2Tokens: `
    query GetAllL2Tokens($first: Int!, $skip: Int!) {
      tokens(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
        id
        tokenAddress
        owner
        name
        symbol
        decimals
        initialSupply
        maxSupply
        totalSupply
        totalUniqueHolders
        totalTransfers
        totalBridges
        chain
        remoteToken
        bridge
        createdAt
      }
    }
  `,

  // Obtener transferencias de ownership pendientes donde el usuario es el nuevo owner
  getPendingOwnershipTransfersByNewOwner: `
    query GetPendingOwnershipTransfersByNewOwner($newOwner: Bytes!) {
      pendingOwnershipTransfers(where: { newOwner: $newOwner }) {
        id
        previousOwner
        newOwner
        createdAt
        createdAtBlock
        createdTxHash
        token {
          id
          tokenAddress
          owner
          name
          symbol
          decimals
          initialSupply
          maxSupply
          chain
          remoteToken
          bridge
          createdAt
        }
      }
    }
  `,
} as const;
