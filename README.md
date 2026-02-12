Token Minter
============

A comprehensive platform for deploying and managing ERC-20 tokens on Celo and Ethereum with cross-chain bridge support.

## Quick Links

| Resource | Description |
|----------|-------------|
| [Token Creation Flows](docs/TOKEN_CREATION_FLOWS.md) | Detailed documentation of all token creation flows |
| [MCP Server](backend/src/mcp/README.md) | Model Context Protocol server for AI agents |
| [Agent REST API](backend/docs/AGENT_API.md) | REST API for programmatic token creation |
| [Smart Contracts](contracts/README.md) | Solidity contracts and deployment info |
| [Subgraph](subgraph/README.md) | GraphQL API for querying tokens |

## Features

- 🚀 **Create tokens on Celo L2** - Fast, low-cost token deployment
- 🌉 **Cross-chain tokens** - Deploy on Ethereum L1 with Celo L2 bridge support
- 🤖 **AI Agent Ready** - MCP server + REST API for automated token management
- 📊 **Subgraph indexing** - Query all tokens, holders, and transfers
- 🖼️ **IPFS metadata** - ERC-7572 compliant token metadata
- 🎟️ **Promo codes** - Discounted or free token creation

## Token Types

| Type | Description | Chains |
|------|-------------|--------|
| **Celo Native** | Tokens only on Celo L2 | Celo |
| **Ethereum Enabled** | Tokens on L1 + L2 with bridge | Ethereum + Celo |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           UI (React)                            │
│                    ui/src/hooks/useCreateToken.ts               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Express.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  REST API   │  │ MCP Server  │  │      Services           │  │
│  │  /api/*     │  │   /mcp      │  │  IPFS, Signer, Storage  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Contracts (Solidity)                   │
│  ┌─────────────────────┐        ┌─────────────────────────────┐ │
│  │  L1TokenFactory     │        │  L2SuperChainTokenFactory   │ │
│  │  (Ethereum)         │◄──────►│  (Celo)                     │ │
│  └─────────────────────┘        └─────────────────────────────┘ │
│              │                              │                    │
│              ▼                              ▼                    │
│  ┌─────────────────────┐        ┌─────────────────────────────┐ │
│  │     L1Token         │        │    L2SuperChainToken        │ │
│  │  (ERC-20 + Bridge)  │◄─────►│    (ERC-20 + IERC7802)      │ │
│  └─────────────────────┘        └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Subgraph (The Graph)                       │
│               Indexes all tokens, transfers, events             │
└─────────────────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Foundry (for contracts)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd minter

# Install dependencies
cd ui && npm install
cd ../backend && npm install
cd ../contracts && forge install
cd ../subgraph && npm install
```

### Configuration

Create `.env` files in each directory. See respective README files for required variables.

### Running Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: UI
cd ui && npm run dev

# Terminal 3: Local blockchain (optional)
cd contracts && anvil
```

## For AI Agents

### MCP (Model Context Protocol)

Connect your AI agent to the MCP server:

```json
{
  "mcpServers": {
    "token-minter": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Available tools:
- `get_supported_chains` - List supported blockchains
- `pin_token_metadata` - Upload metadata to IPFS
- `build_create_token_transaction` - Generate transaction calldata
- `list_tokens` - Query created tokens
- `validate_promo_code` - Apply promotional discounts

### REST API

For non-MCP agents, use the REST endpoints:

```bash
# Get deployment calldata
POST /api/tokens/full-deployment/calldata
{
  "tokenType": "celo-native",
  "owner": "0x...",
  "name": "My Token",
  "symbol": "MTK",
  "initialSupply": "1000000",
  ...
}
```

See [Agent API Documentation](backend/docs/AGENT_API.md) for full details.

---

Technical Details
-----------------

Overview
--------

The project provides a flexible architecture and simple interface for deploying and managing ERC20 tokens with different functionality on Celo and Ethereum Mainnet:

### Key Components

*   **ITokenFactory**: Base interface for token factories TBD
    
*   **Interfaces**:
    
    *   **IUERC20Factory**: Interface for deploying UERC20 tokens for Ethereum Mainnet usage TBD
        
    *   **IUERC20SuperchainFactory**: Interface for deploying UERC20Superchain tokens that work across the Superchain ecosystem TVD
         
*   **Factories**:
    
    *   **CN-ERC20Factory**: For deploying CN-ERC20 tokens for Celo Mainnet usage
        
    *   **EN-ERC20Factory**: For deploying EN-ERC20 tokens that are rooted on Ethereum Mainnet.
        
*   **Libraries**:
    
    *   **UERC20MetadataLibrary**: Handles encoding of token metadata to JSON format TBD
        
*   **BaseUERC20**: Abstract base token implementation with common functionality  TBD
    
*   **Token Implementations**:
    
    *   **CN-ERC20**: ERC-20 tokens deployed and controlled natively on Celo.
        
    *   **EN-ERC20**: ERC-20 tokens implementing IERC7802 for Superchain compatibility
        

Token Features
--------------

### Common Features (BaseUERC20)

*   Standard ERC-20 functionality with EIP-2612 permit support via Solady
    
*   ERC-165 interface support for IERC20, IERC20Permit, and IERC165
    
*   Stores creator address and graffiti (additional data for salt generation)
    
*   Stores optional metadata:
    
    *   **Description**
        
    *   **Website**
        
    *   **Image**
        
*   **tokenURI()**: Returns base64-encoded JSON metadata
    

### UERC20 (Ethereum Mainnet)

*   Standard ERC-20 implementation for Ethereum Mainnet usage
    
*   Includes all BaseUERC20 metadata features
    
*   Simple constructor that gets parameters from factory during deployment
    

### UERC20Superchain (Superchain)

*   Implements IERC7802 for Superchain compatibility
    
*   Supports cross-chain transfers via the SuperchainTokenBridge (0x4200000000000000000000000000000000000028)
    
*   **Home Chain**: The chain where totalSupply is initially minted and metadata is stored
    
*   Ensures the total supply remains constant across all chains
    
*   Metadata (creator, description, website, and image) is stored on the home chain only, so off-chain indexing is required to access them on other chains
    
*   Only mints initial supply when deployed on the home chain
    

Deployment Rules
----------------

### UERC20 (Ethereum Mainnet)

*   The caller (msg.sender) becomes the creator
    
*   The total supply is minted to the specified recipient at deployment time
    
*   The token's address is uniquely determined by its creator, name, symbol, decimals, and graffiti
    
*   **Required validations**:
    
    *   Recipient cannot be zero address
        
    *   Initial supply cannot be zero
        

### UERC20Superchain (Superchain)

*   **On the home chain**: Only the specified creator can deploy the token
    
*   **On other chains**: Anyone can deploy the token permissionlessly at the same address
    
*   The total supply is always minted on the home chain at deployment time
    
*   A UERC20Superchain token can be deployed on any chain at the same address in a permissionless way
    
*   Tokens can move between chains via the Superchain Token Bridge
    
*   The token's address is uniquely determined by its creator, name, symbol, decimals, home chain ID, and graffiti
    
*   **Required validations (home chain only)**:
    
    *   Caller must be the creator
        
    *   Recipient cannot be zero address
        
    *   Initial supply cannot be zero
        

Cross-Chain Transfers (UERC20Superchain)
----------------------------------------

*   The SuperchainTokenBridge facilitates cross-chain transfers
    
*   **Mechanism:**
    
    *   crosschainBurn is called on the source chain, decreasing its local totalSupply
        
    *   crosschainMint is called on the destination chain, increasing its local totalSupply
        
    *   While the totalSupply variable changes on individual chains, the aggregate total supply across all chains remains unchanged at the amount initially minted on the home chain
        
*   Both functions are restricted to the SuperchainTokenBridge and emit appropriate events
    

Factory Interface
-----------------

All factories implement the base ITokenFactory interface with a common createToken function:

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   function createToken(      string calldata name,      string calldata symbol,      uint8 decimals,      uint256 initialSupply,      address recipient,      bytes calldata data,      bytes32 graffiti  ) external returns (address tokenAddress);   `

*   **data**: Factory-specific encoded data
    
    *   UERC20Factory: abi.encode(UERC20Metadata)
        
    *   UERC20SuperchainFactory: abi.encode(homeChainId, creator, UERC20Metadata)
        
*   **graffiti**: Additional data for salt generation to enable address customization
    

Extensibility
-------------

The architecture is designed to be extensible by allowing new token factories to inherit from the base ITokenFactory interface. This enables developers to create specialized implementations with custom functionality while maintaining a consistent interface for token creation.

License
-------

MIT

Usage
-----

### Compile and Run Tests

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   forge install  forge build  forge test   `

### Formatting

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   forge fmt   `

Deployment Addresses
--------------------

### UERC20Factory

**NetworkAddressCommit HashVersion**Mainnet0x0cde87c11b959e5eb0924c1abf5250ee3f9bd1b59705debfea9e6a641bc04352398f9e549055ac44v1.0.0-candidateSepolia0x0cde87c11b959e5eb0924c1abf5250ee3f9bd1b59705debfea9e6a641bc04352398f9e549055ac44v1.0.0-candidate

### USUPERC20Factory

**NetworkAddressCommit HashVersion**Unichain0x24016ed99a69e9b86d16d84351e1661266b7ac6a9705debfea9e6a641bc04352398f9e549055ac44v1.0.0-candidateUnichain Sepolia0x24016ed99a69e9b86d16d84351e1661266b7ac6a9705debfea9e6a641bc04352398f9e549055ac44v1.0.0-candidate

Audits
------

*   3/14 [OpenZeppelin](https://github.com/Uniswap/uerc20-factory/blob/main/docs/The Uniswap ERC-20 Token Factory Audit.pdf)
    
*   6/3 [OpenZeppelin](https://github.com/Uniswap/uerc20-factory/blob/main/docs/UERC20 Factory Separation Diff Audit.pdf)
