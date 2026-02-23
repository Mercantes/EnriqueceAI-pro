'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EvolutionCreateResponse, EvolutionQrResponse, EvolutionStatusResponse } from '../types';

type ConnectionStep = 'idle' | 'creating' | 'waiting_scan' | 'connected' | 'error';

interface EvolutionState {
  step: ConnectionStep;
  qrBase64: string | null;
  phone: string | null;
  instanceName: string | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 5000;

export function useEvolutionWhatsApp() {
  const [state, setState] = useState<EvolutionState>({
    step: 'idle',
    qrBase64: null,
    phone: null,
    instanceName: null,
    error: null,
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(() => {
    const supabase = createClient();

    pollingRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        stopPolling();
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke<EvolutionStatusResponse>('evolution-status');

        if (!mountedRef.current) return;
        if (error || !data) return; // Silently ignore poll errors

        if (data.status === 'connected') {
          stopPolling();
          setState((prev) => ({
            ...prev,
            step: 'connected',
            phone: data.phone,
            qrBase64: null,
          }));
        } else if (data.qr_base64 && data.qr_base64 !== '') {
          setState((prev) => ({
            ...prev,
            qrBase64: data.qr_base64 ?? prev.qrBase64,
          }));
        }
      } catch {
        // Silently ignore — polling will retry on next interval
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, step: 'creating', error: null }));

    const supabase = createClient();

    const { data, error } = await supabase.functions.invoke<EvolutionCreateResponse>('evolution-create-instance');

    if (!mountedRef.current) return;

    if (error || !data) {
      // Extract real error message from edge function response
      let errorMsg = 'Erro ao criar instância';
      if (error) {
        try {
          // FunctionsHttpError has a context with the response
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string }> } }).context;
          if (ctx?.json) {
            const body = await ctx.json();
            errorMsg = body?.error ?? body?.message ?? error.message;
          } else {
            errorMsg = error.message;
          }
        } catch {
          errorMsg = error.message;
        }
      }
      console.error('[evolution] Create instance error:', errorMsg);
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: errorMsg,
      }));
      return;
    }

    if (data.status === 'connected') {
      setState({
        step: 'connected',
        qrBase64: null,
        phone: data.phone ?? null,
        instanceName: data.instance_name,
        error: null,
      });
      return;
    }

    setState({
      step: 'waiting_scan',
      qrBase64: data.qr_base64,
      phone: null,
      instanceName: data.instance_name,
      error: null,
    });

    pollStatus();
  }, [pollStatus]);

  const refreshQr = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase.functions.invoke<EvolutionQrResponse>('evolution-qrcode');

    if (!mountedRef.current) return;

    if (error || !data) {
      let errorMsg = 'Erro ao atualizar QR Code';
      if (error) {
        try {
          const ctx = (error as { context?: { json?: () => Promise<{ error?: string; message?: string }> } }).context;
          if (ctx?.json) {
            const body = await ctx.json();
            errorMsg = body?.error ?? body?.message ?? error.message;
          } else {
            errorMsg = error.message;
          }
        } catch {
          errorMsg = error.message;
        }
      }
      console.error('[evolution] QR refresh error:', errorMsg);
      setState((prev) => ({ ...prev, step: 'error', error: errorMsg }));
      return;
    }

    if (data.status === 'connected') {
      stopPolling();
      setState((prev) => ({
        ...prev,
        step: 'connected',
        phone: data.phone ?? null,
        qrBase64: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      qrBase64: data.qr_base64,
    }));
  }, [stopPolling]);

  const disconnect = useCallback(() => {
    stopPolling();
    setState({
      step: 'idle',
      qrBase64: null,
      phone: null,
      instanceName: null,
      error: null,
    });
  }, [stopPolling]);

  return {
    ...state,
    connect,
    refreshQr,
    disconnect,
  };
}
