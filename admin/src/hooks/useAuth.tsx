import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';

const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://minter-production-6bba.up.railway.app' : '');

interface AuthContextType {
  isAuthenticated: boolean;
  isOwner: boolean;
  isLoading: boolean;
  isSigning: boolean;
  error: string | null;
  token: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
  disconnectWallet: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_STORAGE_KEY = 'admin_session_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedToken && isConnected) {
      verifyStoredToken(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      clearSession();
    }
  }, [isConnected]);

  const verifyStoredToken = async (storedToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/session`, {
        headers: {
          'Authorization': `Bearer ${storedToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.address.toLowerCase() === address?.toLowerCase()) {
          setToken(storedToken);
          setIsAuthenticated(true);
          setIsOwner(data.data.isOwner);
        } else {
          clearSession();
        }
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    setIsAuthenticated(false);
    setIsOwner(false);
    setError(null);
    setIsSigning(false);
  };

  const signIn = useCallback(async () => {
    if (!address || !isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setIsSigning(false);
    setError(null);

    try {
      // 1. Check if address is an owner first
      const ownerCheckResponse = await fetch(`${API_BASE}/api/auth/check-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      const ownerCheckData = await ownerCheckResponse.json();
      
      if (!ownerCheckData.success || !ownerCheckData.data.isOwner) {
        setError('Your address is not a factory owner. Only factory owners can access the admin panel.');
        setIsLoading(false);
        return;
      }

      // 2. Get nonce
      const nonceResponse = await fetch(`${API_BASE}/api/auth/nonce`);
      const nonceData = await nonceResponse.json();
      
      if (!nonceData.success) {
        throw new Error('Failed to get nonce');
      }

      const nonce = nonceData.data.nonce;

      // 3. Create SIWX message
      const domain = window.location.host;
      const uri = window.location.origin;
      const issuedAt = new Date().toISOString();
      const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      const message = `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Token Manager Admin Panel

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${expirationTime}`;

      // 4. Sign message (for Safe, this may take time as it requires multisig approval)
      setIsSigning(true);
      setIsLoading(false); // Stop loading spinner, show signing state
      
      const signature = await signMessageAsync({ message });
      
      setIsSigning(false);
      setIsLoading(true);

      // 5. Verify with backend
      const verifyResponse = await fetch(`${API_BASE}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || 'Verification failed');
      }

      // 6. Store token and update state
      const newToken = verifyData.data.token;
      sessionStorage.setItem(SESSION_STORAGE_KEY, newToken);
      setToken(newToken);
      setIsAuthenticated(true);
      setIsOwner(true);

    } catch (err) {
      console.error('Sign in error:', err);
      setIsSigning(false);
      if (err instanceof Error) {
        if (err.message.includes('User rejected') || err.message.includes('rejected')) {
          setError('Signature rejected. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to sign in');
      }
    } finally {
      setIsLoading(false);
      setIsSigning(false);
    }
  }, [address, isConnected, signMessageAsync]);

  const signOut = useCallback(() => {
    clearSession();
    disconnect();
  }, [disconnect]);

  // Disconnect wallet without clearing session (useful to switch wallets)
  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isOwner,
        isLoading,
        isSigning,
        error,
        token,
        signIn,
        signOut,
        disconnectWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Helper to get auth headers for API calls
 */
export function getAuthHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}
