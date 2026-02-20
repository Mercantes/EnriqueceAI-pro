'use client';

import { CheckCircle2, FileWarning, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { ImportLeadsResult } from '../actions/import-leads';
import { formatCnpj } from '../utils/cnpj';

interface ImportReportProps {
  result: ImportLeadsResult;
}

export function ImportReport({ result }: ImportReportProps) {
  const hasErrors = result.errorCount > 0;
  const allFailed = result.successCount === 0;

  return (
    <div className="space-y-6">
      <Alert variant={allFailed ? 'destructive' : 'default'}>
        {allFailed ? (
          <XCircle className="h-4 w-4" />
        ) : hasErrors ? (
          <FileWarning className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <AlertTitle>
          {allFailed
            ? 'Importação falhou'
            : hasErrors
              ? 'Importação concluída com erros'
              : 'Importação concluída com sucesso'}
        </AlertTitle>
        <AlertDescription>
          <div className="mt-2 flex gap-6 text-sm">
            <span>
              Importados: <strong>{result.successCount}</strong>
            </span>
            {result.duplicateCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Duplicados: <strong>{result.duplicateCount}</strong>
              </span>
            )}
            {result.errorCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                Erros: <strong>{result.errorCount}</strong>
              </span>
            )}
            <span className="text-muted-foreground">
              Total: <strong>{result.totalRows}</strong>
            </span>
          </div>
        </AlertDescription>
      </Alert>

      {result.errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Detalhes dos erros</h3>
          <div className="max-h-60 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Linha</TableHead>
                  <TableHead className="w-40">CNPJ</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.errors.map((error, i) => (
                  <TableRow key={i}>
                    <TableCell>{error.row_number}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {error.cnpj ? formatCnpj(error.cnpj) : '-'}
                    </TableCell>
                    <TableCell className="text-red-600 dark:text-red-400">{error.error_message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button asChild>
          <Link href="/leads">Ver leads</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/leads/import">Nova importação</Link>
        </Button>
      </div>
    </div>
  );
}
