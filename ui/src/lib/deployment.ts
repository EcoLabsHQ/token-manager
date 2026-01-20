import { createPublicClient, createWalletClient, http, getAddress, parseAbi } from 'viem';
import { celoSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Contract ABIs
const SIMPLE_ERC20_ABI = parseAbi([
  'function name() public view returns (string)',
  'function symbol() public view returns (string)',
  'function decimals() public view returns (uint8)',
  'function totalSupply() public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)',
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) public returns (bool)',
  'function mint(address to, uint256 amount) public',
  'function burn(uint256 amount) public',
]);

const FACTORY_ABI = parseAbi([
  'function createToken(address owner, string name, string symbol, uint8 decimals, uint256 maxSupply) public returns (address)',
]);

interface DeploymentConfig {
  privateKey: string;
  rpcUrl?: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
}

export async function deploySimpleERC20(config: DeploymentConfig) {
  const account = privateKeyToAccount(`0x${config.privateKey}`);
  
  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(config.rpcUrl || 'https://alfajores-forno.celo-testnet.org'),
  });

  const walletClient = createWalletClient({
    chain: celoSepolia,
    transport: http(config.rpcUrl || 'https://alfajores-forno.celo-testnet.org'),
    account,
  });

  // Simple ERC20 bytecode (you need to compile and get this)
  const bytecode = '0x'; // Replace with actual bytecode

  try {
    console.log('Deploying SimpleERC20...');
    console.log(`Name: ${config.name}`);
    console.log(`Symbol: ${config.symbol}`);
    console.log(`Decimals: ${config.decimals}`);
    console.log(`Initial Supply: ${config.initialSupply}`);

    // Deploy contract
    const hash = await walletClient.deployContract({
      abi: SIMPLE_ERC20_ABI,
      bytecode,
      args: [config.name, config.symbol, config.decimals, config.initialSupply],
      account,
    });

    console.log('Deployment transaction sent:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const contractAddress = receipt.contractAddress;

    console.log('✅ SimpleERC20 deployed at:', contractAddress);

    return {
      success: true,
      address: contractAddress,
      txHash: hash,
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
    };
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface FactoryDeploymentConfig {
  privateKey: string;
  factoryAddress: string;
  rpcUrl?: string;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
}

export async function createTokenViaFactory(config: FactoryDeploymentConfig) {
  const account = privateKeyToAccount(`0x${config.privateKey}`);
  
  const publicClient = createPublicClient({
    chain: celoSepolia,
    transport: http(config.rpcUrl || 'https://lb.drpc.org/ogrpc?network=celo&dkey=AnN38OUr3EcfnfM04Tc8vZSVaPnrRU8R8IlbKlzbRHZc'),
  });

  const walletClient = createWalletClient({
    chain: celoSepolia,
    transport: http(config.rpcUrl || 'https://lb.drpc.org/ogrpc?network=celo&dkey=AnN38OUr3EcfnfM04Tc8vZSVaPnrRU8R8IlbKlzbRHZc'),
    account,
  });

  try {
    console.log('Creating token via factory...');
    console.log(`Factory: ${config.factoryAddress}`);
    console.log(`Name: ${config.name}`);
    console.log(`Symbol: ${config.symbol}`);

    // Call factory
    const hash = await walletClient.writeContract({
      address: getAddress(config.factoryAddress),
      abi: FACTORY_ABI,
      functionName: 'createToken',
      args: [
        getAddress(account.address),
        config.name,
        config.symbol,
        config.decimals,
        BigInt(config.maxSupply),
      ],
      account,
    });

    console.log('Factory call transaction sent:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Extract token address from logs
    let tokenAddress = null;
    for (const log of receipt.logs) {
      if (log.topics[0]) {
        // First indexed parameter is token address
        const address = '0x' + log.topics[1]?.slice(-40);
        if (address && address !== '0x') {
          tokenAddress = getAddress(address);
          break;
        }
      }
    }

    console.log('✅ Token created at:', tokenAddress);

    return {
      success: true,
      address: tokenAddress,
      txHash: hash,
      name: config.name,
      symbol: config.symbol,
    };
  } catch (error) {
    console.error('❌ Token creation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
