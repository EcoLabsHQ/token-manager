import { useState, useCallback, useEffect } from 'react';
import { BACKEND_API_URL, R2_PUBLIC_URL } from '@/config/contracts';

export interface TokenLogoData {
  url: string;
  contentType: string;
  fileSize: number;
  createdAt?: string;
}

export interface UseTokenLogoReturn {
  uploadLogo: (chainId: number, tokenAddress: string, file: File) => Promise<TokenLogoData>;
  preUploadLogo: (chainId: number, identifier: string, file: File) => Promise<TokenLogoData & { identifier: string }>;
  getLogoUrl: (chainId: number, tokenAddress: string) => Promise<string | null>;
  getLogoBatch: (tokens: Array<{ chainId: number; address: string }>) => Promise<Record<string, string>>;
  deleteLogo: (chainId: number, tokenAddress: string) => Promise<void>;
  copyLogoToTokenAddress: (chainId: number, tokenAddress: string, sourceHash: string) => Promise<TokenLogoData>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  logoUpdateTrigger: number; // Increment when logos are updated
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

// Global event emitter for logo updates
type LogoUpdateListener = () => void;
const logoUpdateListeners = new Set<LogoUpdateListener>();

export function subscribeToLogoUpdates(listener: LogoUpdateListener): () => void {
  logoUpdateListeners.add(listener);
  return () => logoUpdateListeners.delete(listener);
}

function notifyLogoUpdate() {
  logoUpdateListeners.forEach(listener => listener());
}

/**
 * Genera la URL directa del logo desde R2 (sin llamar al backend)
 */
export function getDirectLogoUrl(chainId: number, tokenAddress: string, extension = 'png'): string {
  return `${R2_PUBLIC_URL}/logos/${chainId}/${tokenAddress.toLowerCase()}.${extension}`;
}

/**
 * Busca la URL del logo de un token a través del backend API (evita CORS con R2 directo)
 * Retorna la URL pública o null si no existe logo
 */
export async function findLogoUrl(chainId: number, tokenAddress: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${BACKEND_API_URL}/api/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo`
    );
    if (response.status === 404) return null;
    if (!response.ok) return null;
    const result = await response.json();
    return result.data?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Busca logos para múltiples tokens usando el endpoint batch del backend (evita CORS con R2 directo)
 */
export async function findLogoBatch(
  tokens: Array<{ chainId: number; address: string }>
): Promise<Record<string, string>> {
  if (tokens.length === 0) return {};

  try {
    const response = await fetch(`${BACKEND_API_URL}/api/tokens/logos/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
    });
    if (!response.ok) return {};
    const result = await response.json();
    // El backend devuelve claves "chainId:address"; normalizamos a solo "address" para compatibilidad
    const raw: Record<string, string> = result.data ?? {};
    const normalized: Record<string, string> = {};
    for (const [key, url] of Object.entries(raw)) {
      const address = key.includes(':') ? key.split(':').pop()! : key;
      normalized[address.toLowerCase()] = url;
    }
    return normalized;
  } catch {
    return {};
  }
}

/**
 * Hook para gestionar logos de tokens
 */
export function useTokenLogo(): UseTokenLogoReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(0);

  // Subscribe to global logo updates
  useEffect(() => {
    return subscribeToLogoUpdates(() => {
      setLogoUpdateTrigger(prev => prev + 1);
    });
  }, []);

  /**
   * Sube un logo para un token
   */
  const uploadLogo = useCallback(async (
    chainId: number,
    tokenAddress: string,
    file: File
  ): Promise<TokenLogoData> => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validar tipo de archivo
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Tipo de archivo no permitido. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
      }

      // Validar tamaño
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Archivo muy grande. Máximo: ${MAX_FILE_SIZE / 1024}KB`);
      }

      const formData = new FormData();
      formData.append('logo', file);

      setUploadProgress(30);

      const response = await fetch(
        `${BACKEND_API_URL}/api/tokens/${chainId}/${tokenAddress}/logo`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Error al subir el logo');
      }

      const result = await response.json();
      setUploadProgress(100);

      // Notify all listeners that a logo was updated
      notifyLogoUpdate();

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * Sube un logo ANTES de crear el token usando un hash identifier
   * Este endpoint NO guarda en la DB, solo sube a R2
   */
  const preUploadLogo = useCallback(async (
    chainId: number,
    identifier: string,
    file: File
  ): Promise<TokenLogoData & { identifier: string }> => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Validar tipo de archivo
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Tipo de archivo no permitido. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
      }

      // Validar tamaño
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Archivo muy grande. Máximo: ${MAX_FILE_SIZE / 1024}KB`);
      }

      const formData = new FormData();
      formData.append('logo', file);

      setUploadProgress(30);

      const response = await fetch(
        `${BACKEND_API_URL}/api/tokens/${chainId}/pre-upload/${identifier}/logo`,
        {
          method: 'POST',
          body: formData,
        }
      );

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Error al subir el logo');
      }

      const result = await response.json();
      setUploadProgress(100);

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * Obtiene la URL del logo de un token
   */
  const getLogoUrl = useCallback(async (
    chainId: number,
    tokenAddress: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/tokens/${chainId}/${tokenAddress}/logo`
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error('Error al obtener el logo');
      }

      const result = await response.json();
      return result.data.url;
    } catch (err) {
      console.error('Error getting logo:', err);
      return null;
    }
  }, []);

  /**
   * Obtiene las URLs de logos para múltiples tokens
   */
  const getLogoBatch = useCallback(async (
    tokens: Array<{ chainId: number; address: string }>
  ): Promise<Record<string, string>> => {
    if (tokens.length === 0) return {};

    try {
      const response = await fetch(
        `${BACKEND_API_URL}/api/tokens/logos/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tokens }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener logos');
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      console.error('Error getting batch logos:', err);
      return {};
    }
  }, []);

  /**
   * Elimina el logo de un token
   */
  const deleteLogo = useCallback(async (
    chainId: number,
    tokenAddress: string
  ): Promise<void> => {
    const response = await fetch(
      `${BACKEND_API_URL}/api/tokens/${chainId}/${tokenAddress}/logo`,
      {
        method: 'DELETE',
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al eliminar el logo');
    }
  }, []);

  /**
   * Copia una imagen de un hash temporal a la dirección real del token
   */
  const copyLogoToTokenAddress = useCallback(async (
    chainId: number,
    tokenAddress: string,
    sourceHash: string
  ): Promise<TokenLogoData> => {
    const response = await fetch(
      `${BACKEND_API_URL}/api/tokens/${chainId}/${tokenAddress}/logo/copy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceHash }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al copiar el logo');
    }

    const result = await response.json();
    
    // Notify all listeners that a logo was updated
    notifyLogoUpdate();

    return result.data;
  }, []);

  return {
    uploadLogo,
    preUploadLogo,
    getLogoUrl,
    getLogoBatch,
    deleteLogo,
    copyLogoToTokenAddress,
    isUploading,
    uploadProgress,
    error,
    logoUpdateTrigger,
  };
}

export default useTokenLogo;
