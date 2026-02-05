import { useState, useCallback } from 'react';
import { BACKEND_API_URL, R2_PUBLIC_URL } from '@/config/contracts';

export interface TokenLogoData {
  url: string;
  contentType: string;
  fileSize: number;
  createdAt?: string;
}

export interface UseTokenLogoReturn {
  uploadLogo: (chainId: number, tokenAddress: string, file: File) => Promise<TokenLogoData>;
  getLogoUrl: (chainId: number, tokenAddress: string) => Promise<string | null>;
  getLogoBatch: (tokens: Array<{ chainId: number; address: string }>) => Promise<Record<string, string>>;
  deleteLogo: (chainId: number, tokenAddress: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];

/**
 * Genera la URL directa del logo desde R2 (sin llamar al backend)
 */
export function getDirectLogoUrl(chainId: number, tokenAddress: string, extension = 'png'): string {
  return `${R2_PUBLIC_URL}/logos/${chainId}/${tokenAddress.toLowerCase()}.${extension}`;
}

/**
 * Hook para gestionar logos de tokens
 */
export function useTokenLogo(): UseTokenLogoReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  return {
    uploadLogo,
    getLogoUrl,
    getLogoBatch,
    deleteLogo,
    isUploading,
    uploadProgress,
    error,
  };
}

export default useTokenLogo;
