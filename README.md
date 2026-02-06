Token Manager dApp
=============

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
