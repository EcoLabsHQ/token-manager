import { Bytes } from "@graphprotocol/graph-ts"
import { 
  RemoteTokenUpdated as RemoteTokenUpdatedEvent,
  BridgeUpdated as BridgeUpdatedEvent
} from "../generated/templates/L2SuperChainToken/L2SuperChainToken"
import { Token } from "../generated/schema"

export function handleRemoteTokenUpdated(event: RemoteTokenUpdatedEvent): void {
  // The token address is the contract that emitted the event
  const tokenAddress = event.address
  
  let token = Token.load(tokenAddress)
  if (token) {
    token.remoteToken = event.params.newRemoteToken
    token.save()
  }
}

export function handleBridgeUpdated(event: BridgeUpdatedEvent): void {
  // The token address is the contract that emitted the event
  const tokenAddress = event.address
  
  let token = Token.load(tokenAddress)
  if (token) {
    token.bridge = event.params.newBridge
    token.save()
  }
}
