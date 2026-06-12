# Factory Contracts

Both factories inherit `BaseTokenFactory` and implement `IFactory`.

## Creation functions

```solidity
// Standard creation (fee required)
function createToken(
    address owner_, string memory name_, string memory symbol_,
    uint8 decimals_, uint256 initialSupply_, uint256 maxSupply_,
    bytes memory salt_
) external payable returns (address);

// With promo discount
function createTokenWithPromo(
    ..., uint256 promoFee_, bytes32 promoNonce_,
    uint256 expiresAt_, bytes memory signature_
) external payable returns (address);

// L2SuperChainTokenFactory only — bridged token, NO fee (paid on L1)
function createTokenWithBridge(
    ..., address bridge_, address remoteToken_, bytes memory salt_
) external returns (address);
```

## Deployment rules

| | L1Token | L2SuperChainToken |
| - | ------- | ----------------- |
| Owner | Caller (`msg.sender`) | Caller (`msg.sender`) |
| Address | CREATE2 from owner, name, symbol, decimals, salt | Same — identical addresses across Superchain networks |
| Modes | — | Native (`bridge = 0`) or Bridged (`bridge` + `remoteToken` set, both non-zero) |
| Validations | Recipient ≠ zero address; initialSupply ≤ maxSupply | Same |

## Example

```solidity
// Native token on Celo
address t = factory.createToken{value: creationFee}(
    msg.sender, "My Token", "MTK", 18,
    1_000_000 ether, 10_000_000 ether,
    abi.encodePacked(msg.sender, block.timestamp)
);
```
