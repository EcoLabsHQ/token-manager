# Minter Subgraphs

Este proyecto contiene 2 subgraphs separados para indexar los Token Factories en diferentes redes, usando **Mustache templates** para generar el `subgraph.yaml` dinámicamente.

## Subgraphs

| Nombre | Red | Contrato | Config |
|--------|-----|----------|--------|
| `minter-ethereum` | Ethereum Mainnet (L1) | L1TokenFactory | `config/ethereum.json` |
| `minter-celo` | Celo Mainnet (L2) | L2SuperChainTokenFactory | `config/celo.json` |

## Requisitos previos

1. Crear los subgraphs en [The Graph Studio](https://thegraph.com/studio/):
   - Crear subgraph con slug: `minter-ethereum`
   - Crear subgraph con slug: `minter-celo`

2. Obtener tu Deploy Key desde la página de detalles del subgraph en Studio.

## Instalación

```bash
npm install
```

## Autenticación

Autentícate con tu Deploy Key de The Graph Studio:

```bash
npm run auth
# Ingresa tu Deploy Key cuando se solicite
```

## Desarrollo

### Build individual

```bash
# Build para Ethereum (genera subgraph.yaml desde template, codegen y build)
npm run build:ethereum

# Build para Celo
npm run build:celo
```

### Solo preparar el template

```bash
# Genera subgraph.yaml para Ethereum
npm run prepare:ethereum

# Genera subgraph.yaml para Celo  
npm run prepare:celo
```

## Deployment

### Desplegar a The Graph Studio

```bash
# Desplegar L1 (Ethereum Mainnet)
npm run deploy:ethereum

# Desplegar L2 (Celo Mainnet)
npm run deploy:celo
```

Se te pedirá una versión (ej: `0.0.1`). Usa [semver](https://semver.org/) para el versionado.

## Arquitectura

El proyecto usa **Mustache templates** siguiendo las [mejores prácticas de The Graph](https://thegraph.com/docs/en/subgraphs/developing/deploying/multiple-networks/):

```
subgraph/
├── subgraph.template.yaml    # Template base con placeholders
├── config/
│   ├── ethereum.json         # Config para Ethereum Sepolia
│   └── celo.json             # Config para Celo Sepolia
├── abis/
│   ├── L1TokenFactory.json
│   └── L2SuperChainTokenFactory.json
├── src/
│   ├── l1-token-factory.ts   # Mapping para L1
│   └── l2-token-factory.ts   # Mapping para L2
├── schema.graphql
└── subgraph.yaml             # Generado automáticamente (no commitear)
```

## Queries

### Ethereum L1 (minter-ethereum)

```graphql
{
  tokens(first: 10) {
    id
    tokenAddress
    name
    symbol
    creator
    createdAt
  }
}
```

### Celo L2 (minter-celo)

```graphql
{
  tokens(first: 10) {
    id
    tokenAddress
    name
    symbol
    creator
    createdAt
  }
}
```
