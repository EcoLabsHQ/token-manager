# Subgraph

Two subgraphs index the token factories, generated from one Mustache template (`subgraph.template.yaml`) per [The Graph's multi-network best practices](https://thegraph.com/docs/en/subgraphs/developing/deploying/multiple-networks/).

| Name | Network | Contract |
| ---- | ------- | -------- |
| `minter-ethereum` | Ethereum Mainnet | L1TokenFactory |
| `minter-celo` | Celo Mainnet | L2SuperChainTokenFactory |

## Setup & deploy

1. Create both subgraphs (slugs above) in [The Graph Studio](https://thegraph.com/studio/) and grab your Deploy Key.

```bash
npm install
npm run auth              # enter Deploy Key

npm run build:ethereum    # template → codegen → build
npm run build:celo

npm run deploy:ethereum   # prompts for a semver version, e.g. 0.0.1
npm run deploy:celo
```

{% hint style="info" %}
`subgraph.yaml` is auto-generated from the template — don't commit it.
{% endhint %}

## Example query

```graphql
{
  tokens(first: 10) {
    id tokenAddress name symbol creator createdAt
  }
}
```
