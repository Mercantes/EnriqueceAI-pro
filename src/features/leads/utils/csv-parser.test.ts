import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv-parser';

describe('csv-parser', () => {
  describe('parseCsv', () => {
    it('should parse a simple CSV with CNPJ header', () => {
      const csv = 'cnpj\n11222333000181\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
      expect(result.rows[1]?.cnpj).toBe('45678901000175');
    });

    it('should detect CNPJ column with different header names', () => {
      const csv = 'nome,documento\nTest,11222333000181';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should extract razao_social and nome_fantasia', () => {
      const csv = 'cnpj,razao_social,nome_fantasia\n11222333000181,Empresa Ltda,EmpLtda';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa Ltda');
      expect(result.rows[0]?.nome_fantasia).toBe('EmpLtda');
    });

    it('should handle formatted CNPJs', () => {
      const csv = 'cnpj\n11.222.333/0001-81';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should reject invalid-CNPJ rows only when nothing else identifies them', () => {
      // CNPJ-only file: a bad checksum leaves the row with zero identifiers,
      // so it still fails — but the message says why.
      const csv = 'cnpj\n11222333000181\n00000000000000\n11222333000199';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]?.errorMessage).toContain('CNPJ inválido');
      expect(result.errors[0]?.errorMessage).toContain('nenhum outro identificador');
      expect(result.errors[0]?.rowNumber).toBe(3);
    });

    it('should import rows with invalid CNPJ when another identifier exists', () => {
      // O CNPJ é chave de enriquecimento, não requisito de importação: checksum
      // ruim vira lead sem CNPJ + aviso, em vez de linha descartada.
      const csv = 'cnpj,razao_social,email\n11222333000199,Empresa Boa,contato@boa.com.br';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]?.cnpj).toBeNull();
      expect(result.rows[0]?.razao_social).toBe('Empresa Boa');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('CNPJ inválido');
      expect(result.warnings[0]?.rowNumber).toBe(2);
    });

    it('should restore leading zeros eaten by spreadsheets', () => {
      // 01023456000130 salvo como número vira 1023456000130 (13 dígitos).
      const csv = 'cnpj,razao_social\n1023456000130,Empresa Zero';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('01023456000130');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('zeros à esquerda');
    });

    it('should not warn when the CNPJ needed no padding', () => {
      const csv = 'cnpj,razao_social\n11222333000181,Empresa Ok';
      const result = parseCsv(csv);

      expect(result.rows[0]?.cnpj).toBe('11222333000181');
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept rows with empty CNPJ when another identifier is present', () => {
      // After CNPJ became optional, an empty CNPJ no longer rejects the row —
      // dedup falls back to email or razao_social+telefone. The row only fails
      // when nothing identifies it.
      const csv = 'cnpj,razao_social\n11222333000181,ok\n,Empresa Sem CNPJ';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
      expect(result.rows[1]?.cnpj).toBeNull();
      expect(result.rows[1]?.razao_social).toBe('Empresa Sem CNPJ');
    });

    it('should reject rows with no identifying field at all', () => {
      // Linha com dado, mas nenhum identificador (só o cargo preenchido).
      const csv = 'cnpj,razao_social,email,telefone,cargo\n11222333000181,ok,,,\n,,,,CEO';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toContain('sem identificação');
    });

    it('should ignore filler rows made only of delimiters', () => {
      // Excel deixa ";;;" no fim do arquivo. Isso é ruído, não erro — antes
      // virava "linha sem identificação" e sujava o relatório.
      const csv = 'cnpj,razao_social\n11222333000181,ok\n,\n,';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.totalRows).toBe(1);
    });

    it('should return error for empty file', () => {
      const result = parseCsv('');
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toContain('vazio');
    });

    it('should return error for header-only file', () => {
      const result = parseCsv('cnpj');
      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should accept files without CNPJ column when email is present', () => {
      // 'nome' is not one of the recognized identifying columns, so razao_social
      // mapping needs an explicit header; here we rely on email instead.
      const csv = 'razao_social,email\nTest,test@test.com';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBeNull();
      expect(result.rows[0]?.email).toBe('test@test.com');
      expect(result.rows[0]?.razao_social).toBe('Test');
    });

    it('should return error when no identifying column exists', () => {
      const csv = 'nome,observacao\nTest,nota qualquer';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.errorMessage).toContain('Nenhuma coluna identificável');
    });

    it('should reject files with more than 1000 rows', () => {
      const rows = ['cnpj'];
      for (let i = 0; i < 1001; i++) {
        rows.push('11222333000181');
      }
      const result = parseCsv(rows.join('\n'));

      expect(result.rows).toHaveLength(0);
      expect(result.errors[0]?.errorMessage).toContain('1000');
    });

    it('should handle semicolon-separated CSV', () => {
      const csv = 'cnpj;razao_social\n11222333000181;Empresa Ltda';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa Ltda');
    });

    it('should handle quoted fields', () => {
      const csv = 'cnpj,razao_social\n11222333000181,"Empresa, Ltda"';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('Empresa, Ltda');
    });

    it('should auto-detect CNPJ column by content', () => {
      const csv = 'id,number,name\n1,11222333000181,Test';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
    });

    it('should set correct row numbers', () => {
      const csv = 'cnpj\n11222333000181\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows[0]?.rowNumber).toBe(2);
      expect(result.rows[1]?.rowNumber).toBe(3);
    });

    it('should handle Windows line endings', () => {
      const csv = 'cnpj\r\n11222333000181\r\n45678901000175';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
    });

    it('should extract telefone column and build phones array (celular)', () => {
      const csv = 'cnpj,telefone\n11222333000181,(11) 99876-5432';
      const result = parseCsv(csv);

      expect(result.rows[0]?.telefone).toBe('(11) 99876-5432');
      expect(result.rows[0]?.phones).toEqual([{ tipo: 'celular', numero: '(11) 99876-5432' }]);
    });

    it('should classify landline phones as fixo', () => {
      const csv = 'cnpj,telefone\n11222333000181,(11) 3456-7890';
      const result = parseCsv(csv);

      expect(result.rows[0]?.phones?.[0]?.tipo).toBe('fixo');
    });

    it('should extract email column and classify domain', () => {
      const csv = 'cnpj,email\n11222333000181,contato@empresa.com.br';
      const result = parseCsv(csv);

      expect(result.rows[0]?.email).toBe('contato@empresa.com.br');
      expect(result.rows[0]?.emails).toEqual([{ tipo: 'corporativo', email: 'contato@empresa.com.br' }]);
    });

    it('should classify gmail/hotmail as pessoal', () => {
      const csv = 'cnpj,email\n11222333000181,joao@gmail.com';
      const result = parseCsv(csv);

      expect(result.rows[0]?.emails?.[0]?.tipo).toBe('pessoal');
    });

    it('should extract decisor and job_title', () => {
      const csv = 'cnpj,decisor,cargo\n11222333000181,João Silva,CEO';
      const result = parseCsv(csv);

      expect(result.rows[0]?.decisor).toBe('João Silva');
      expect(result.rows[0]?.job_title).toBe('CEO');
    });

    it('should extract website/instagram/linkedin', () => {
      const csv = 'cnpj,website,instagram,linkedin\n11222333000181,https://x.com,@xco,linkedin.com/x';
      const result = parseCsv(csv);

      expect(result.rows[0]?.website).toBe('https://x.com');
      expect(result.rows[0]?.instagram).toBe('@xco');
      expect(result.rows[0]?.linkedin).toBe('linkedin.com/x');
    });

    it('should accept Brazilian header variants (telefone, e-mail, contato)', () => {
      const csv = 'cnpj,e-mail,celular,contato\n11222333000181,a@b.com,(11) 99999-9999,Maria';
      const result = parseCsv(csv);

      expect(result.rows[0]?.email).toBe('a@b.com');
      expect(result.rows[0]?.telefone).toBe('(11) 99999-9999');
      expect(result.rows[0]?.decisor).toBe('Maria');
    });

    it('should accept descriptive header variants via substring match', () => {
      // Rafael Alécio's lista-FUNERÁRIA.csv case: headers like "Nome do Decisor",
      // "E-mail Comercial", "Telefone 1" were silently ignored by exact-match,
      // so decisor/email/telefone landed as NULL on every imported lead.
      const csv =
        'cnpj,nome do decisor,e-mail comercial,telefone 1,cargo do decisor\n' +
        '11222333000181,Carlos Souza,carlos@empresa.com,(11) 98765-4321,Diretor Comercial';
      const result = parseCsv(csv);

      expect(result.rows[0]?.decisor).toBe('Carlos Souza');
      expect(result.rows[0]?.email).toBe('carlos@empresa.com');
      expect(result.rows[0]?.telefone).toBe('(11) 98765-4321');
      expect(result.rows[0]?.job_title).toBe('Diretor Comercial');
    });

    it('should combine first name + last name into decisor (Apollo export style)', () => {
      const csv =
        'cnpj,first name,last name,email,title,phone\n' +
        '11222333000181,Maria,Silva Santos,maria@x.com,CEO,(11) 91234-5678';
      const result = parseCsv(csv);

      expect(result.rows[0]?.decisor).toBe('Maria Silva Santos');
      expect(result.rows[0]?.email).toBe('maria@x.com');
      expect(result.rows[0]?.job_title).toBe('CEO');
    });

    it('should prefer "Telefone Decisor" over "Celular" / "Telefone Fixo" / "Tel 2"', () => {
      // V4-enriched export (Giovanni's lista-Estética 2026-05-25): four phone
      // columns side-by-side. Before scoring, "Celular" (exact match in the
      // legacy detector) hijacked the slot — every imported lead lost the
      // decisor's number. Decision-maker scores +10, beats Celular (+5),
      // Fixo (-3) and Tel 2 (-8).
      const csv =
        'cnpj,Telefone Decisor,Telefone Fixo,Celular,Tel 2\n' +
        '11222333000181,11995307857,1132283036,11999348601,11987654321';
      const result = parseCsv(csv);

      expect(result.rows[0]?.telefone).toBe('11995307857');
      // phones[] keeps every non-empty number, de-duped on digits, sorted by
      // score (best first) so the SDR sees the strongest contact at the top.
      // Decisor (+10) > Celular (+5) > Fixo (-3) > Tel 2 (-8).
      expect(result.rows[0]?.phones?.map((p) => p.numero)).toEqual([
        '11995307857',
        '11999348601',
        '1132283036',
        '11987654321',
      ]);
      // Header-driven tipo: "Celular" → 'celular', "Telefone Fixo" → 'fixo'.
      expect(result.rows[0]?.phones?.[1]?.tipo).toBe('celular');
      expect(result.rows[0]?.phones?.[2]?.tipo).toBe('fixo');
    });

    it('should fall back to a lower-scored column when the decisor column is empty', () => {
      // Decisor column blank + Celular filled → use Celular instead of dropping
      // the phone entirely.
      const csv =
        'cnpj,Telefone Decisor,Celular\n' +
        '11222333000181,,11999998888';
      const result = parseCsv(csv);

      expect(result.rows[0]?.telefone).toBe('11999998888');
      expect(result.rows[0]?.phones).toEqual([{ tipo: 'celular', numero: '11999998888' }]);
    });

    it('should de-dup repeated phone numbers across columns', () => {
      // Some exporters copy the decisor's number into "Celular" too. Without
      // dedup the lead ends up with the same number twice.
      const csv =
        'cnpj,Telefone Decisor,Celular\n' +
        '11222333000181,(11) 99999-9999,11999999999';
      const result = parseCsv(csv);

      expect(result.rows[0]?.phones).toHaveLength(1);
      expect(result.rows[0]?.phones?.[0]?.numero).toBe('(11) 99999-9999');
    });

    it('should mark WhatsApp-header columns as tipo "whatsapp"', () => {
      const csv =
        'cnpj,WhatsApp do Decisor,Telefone Fixo\n' +
        '11222333000181,11988887777,1133334444';
      const result = parseCsv(csv);

      expect(result.rows[0]?.telefone).toBe('11988887777');
      expect(result.rows[0]?.phones?.[0]?.tipo).toBe('whatsapp');
      expect(result.rows[0]?.phones?.[1]?.tipo).toBe('fixo');
    });

    it('should not let "Nome Fantasia" steal the decisor slot', () => {
      // The decisor pattern includes "nome", so without the priority-ordered
      // detection "Nome Fantasia" would match decisor and leave fantasia empty.
      const csv =
        'cnpj,nome fantasia,nome do decisor\n' +
        '11222333000181,EmpFantasia,João Pessoa';
      const result = parseCsv(csv);

      expect(result.rows[0]?.nome_fantasia).toBe('EmpFantasia');
      expect(result.rows[0]?.decisor).toBe('João Pessoa');
    });
  });

  // Casos que o tokenizer artesanal errava e motivaram a troca por Papaparse.
  describe('formatos de arquivo', () => {
    it('mantém quebra de linha dentro de campo entre aspas', () => {
      // Antes: o split por \n cortava o registro no meio e desalinhava TODAS
      // as linhas seguintes do arquivo.
      const csv =
        'cnpj,razao_social,email\n' +
        '11222333000181,"Empresa Alfa\nRua das Flores, 100",alfa@x.com\n' +
        '45678901000175,Empresa Beta,beta@x.com';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.razao_social).toBe('Empresa Alfa\nRua das Flores, 100');
      expect(result.rows[1]?.cnpj).toBe('45678901000175');
      expect(result.rows[1]?.email).toBe('beta@x.com');
    });

    it('não quebra colunas com vírgula dentro de arquivo separado por ponto e vírgula', () => {
      // "EMPRESA X, LTDA" num CSV `;` era fatiado porque o parser tratava `,`
      // e `;` como delimitador ao mesmo tempo.
      const csv =
        'cnpj;razao_social;email\n' +
        '11222333000181;EMPRESA X, LTDA;x@empresa.com.br';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.razao_social).toBe('EMPRESA X, LTDA');
      expect(result.rows[0]?.email).toBe('x@empresa.com.br');
    });

    it('aceita arquivo separado por tabulação', () => {
      const csv = 'cnpj\trazao_social\n11222333000181\tEmpresa Tab';
      const result = parseCsv(csv);

      expect(result.rows[0]?.razao_social).toBe('Empresa Tab');
    });

    it('remove o BOM do Excel sem contaminar o primeiro cabeçalho', () => {
      const csv = '﻿cnpj,razao_social\n11222333000181,Empresa BOM';
      const result = parseCsv(csv);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.cnpj).toBe('11222333000181');
      expect(result.rows[0]?.razao_social).toBe('Empresa BOM');
    });
  });
});
