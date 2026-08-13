import { NextResponse } from 'next/server';

// Version/deploy probe. Retorna o commit git do build para confirmar QUAL código
// está no ar com um único curl — resolve o "CI verde != deploy no ar". Não toca
// banco nem serviço externo; dinâmico para nunca ser cacheado/prerenderizado.
//
// Fonte do commit (primeiro não-vazio vence):
//  - SOURCE_COMMIT: o Coolify injeta no RUNTIME do container (caminho principal).
//  - APP_COMMIT: caminho alternativo via build-arg do Dockerfile, SE configurado
//    no Coolify (hoje cai em 'unknown' porque o build-arg não é passado).
// O campo `source` diz de onde veio (ou 'none'), para diagnóstico sem adivinhação.
export const dynamic = 'force-dynamic';

export function GET() {
  const candidates: Array<[string, string | undefined]> = [
    ['SOURCE_COMMIT', process.env.SOURCE_COMMIT],
    ['APP_COMMIT', process.env.APP_COMMIT],
    ['COOLIFY_GIT_COMMIT_SHA', process.env.COOLIFY_GIT_COMMIT_SHA],
  ];
  const hit = candidates.find(([, v]) => v && v !== 'unknown');
  const commit = hit?.[1] ?? 'unknown';
  return NextResponse.json({
    status: 'ok',
    commit,
    commitShort: commit.slice(0, 7),
    source: hit?.[0] ?? 'none',
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  });
}
