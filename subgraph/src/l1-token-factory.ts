import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { TokenCreated as TokenCreatedEvent } from "../generated/L1TokenFactory/L1TokenFactory"
import { TokenFactory, Token, TokenCreatedEvent as TokenCreatedEventEntity } from "../generated/schema"
import { L1Token as L1TokenTemplate } from "../generated/templates"

const CHAIN = "ethereum"

function getOrCreateFactory(address: Bytes, timestamp: BigInt): TokenFactory {
  let factory = TokenFactory.load(address)
  if (!factory) {
    factory = new TokenFactory(address)
    factory.chain = CHAIN
    factory.tokenCount = BigInt.fromI32(0)
    factory.createdAt = timestamp
    factory.updatedAt = timestamp
  }
  return factory
}

export function handleL1TokenCreated(event: TokenCreatedEvent): void {
  const factoryAddress = event.address
  const tokenAddress = event.params.tokenAddress

  // Get or create factory
  let factory = getOrCreateFactory(factoryAddress, event.block.timestamp)
  factory.tokenCount = factory.tokenCount.plus(BigInt.fromI32(1))
  factory.updatedAt = event.block.timestamp
  factory.save()

  // Create token entity
  let token = new Token(tokenAddress)
  token.factory = factoryAddress
  token.tokenAddress = tokenAddress
  token.name = event.params.name
  token.symbol = event.params.symbol
  token.decimals = event.params.decimals
  token.initialSupply = event.params.initialSupply
  token.maxSupply = event.params.maxSupply
  token.totalSupply = BigInt.fromI32(0) // Will be updated via Transfer events
  token.totalUniqueHolders = BigInt.fromI32(0) // Will be updated via Transfer events
  token.owner = event.params.owner
  token.chain = CHAIN
  token.createdAt = event.block.timestamp
  token.createdAtBlock = event.block.number
  token.createdTxHash = event.transaction.hash
  token.save()

  // Create dynamic data source to track token events (OwnershipTransferStarted, OwnershipTransferred)
  L1TokenTemplate.create(tokenAddress)

  // Create immutable event entity
  const eventId = event.transaction.hash.concatI32(event.logIndex.toI32())
  let tokenCreatedEvent = new TokenCreatedEventEntity(eventId)
  tokenCreatedEvent.factory = factoryAddress
  tokenCreatedEvent.tokenAddress = tokenAddress
  tokenCreatedEvent.name = event.params.name
  tokenCreatedEvent.symbol = event.params.symbol
  tokenCreatedEvent.decimals = event.params.decimals
  tokenCreatedEvent.initialSupply = event.params.initialSupply
  tokenCreatedEvent.maxSupply = event.params.maxSupply
  tokenCreatedEvent.owner = event.params.owner
  tokenCreatedEvent.chain = CHAIN
  tokenCreatedEvent.blockNumber = event.block.number
  tokenCreatedEvent.blockTimestamp = event.block.timestamp
  tokenCreatedEvent.transactionHash = event.transaction.hash
  tokenCreatedEvent.save()
}
