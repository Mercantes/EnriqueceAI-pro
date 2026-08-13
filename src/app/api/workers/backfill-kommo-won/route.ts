import { NextResponse } from 'next/server';

export const maxDuration = 60;

/**
 * DISABLED (13/ago/2026) — stub inerte, mantido só para a rota não 404.
 *
 * Este worker one-shot movia o deal de TODO lead "won" para a coluna "Venda
 * ganha" do Kommo (status 142). O mapeamento estava ERRADO: no fluxo do app
 * "Ganho" = o SDR fez a reunião acontecer (um SAL), NÃO uma venda fechada. Ver a
 * reversão em `markLeadAsWon` (voltou a create-only) e o incidente de
 * backfill-overreach de 13/ago que essa varredura causou (303 deals movidos
 * indevidamente, inclusive perdidos, restaurados depois).
 *
 * Fica desativado para não poder ser re-disparado e repetir o estrago. NÃO
 * reabilitar um worker de won-mapping em massa. Se algum dia for preciso um
 * ajuste pontual de CRM, escreva um script estreito, mirado por deal-id e
 * revisado antes de rodar.
 */
export function POST() {
  return NextResponse.json(
    {
      error: 'disabled',
      reason:
        'backfill-kommo-won foi desativado: mapear "Ganho" (reunião realizada) para "Venda ganha" no Kommo foi revertido para create-only. Ver markLeadAsWon.',
    },
    { status: 410 },
  );
}
