# Security

{% hint style="warning" %}
**No external audits completed yet.** See `contracts/docs/SECURITY.md` in the repo for the threat model, trust assumptions, and known attack vectors.
{% endhint %}

## Access control

| Role | Tokens | Factories |
| ---- | ------ | --------- |
| Owner | Full control (mint, burn, pause, upgrade) | Full control |
| Bridge | mint/burn only (L2, bridged mode) | — |
| SuperchainBridge | crosschainMint/Burn only | — |
| Anyone | transfer, approve | createToken |

## Mechanisms

1. **Ownable2StepUpgradeable** — two-step ownership transfer
2. **ReentrancyGuard** — on all factory functions
3. **Pausable** — emergency stop on transfers
4. **UUPS onlyOwner** — only owner can upgrade
5. **EIP-7201 storage** — no collisions on upgrade

Runtime error reference: [Errors & Troubleshooting](../resources/errors-and-troubleshooting.md).
