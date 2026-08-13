import { NextResponse } from 'next/server';

// Version/deploy probe. Retorna o commit git embutido no build (o Coolify injeta
// SOURCE_COMMIT como build-arg → APP_COMMIT no runtime; ver Dockerfile). Permite
// confirmar QUAL código está no ar com um único curl — resolve o "CI verde !=
// deploy no ar". Não toca banco nem serviço externo; deve ficar dinâmico para
// nunca ser cacheado/prerenderizado.
export const dynamic = 'force-dynamic';

export function GET() {
  const commit = process.env.APP_COMMIT ?? 'unknown';
  return NextResponse.json({
    status: 'ok',
    commit,
    commitShort: commit.slice(0, 7),
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
  });
}
