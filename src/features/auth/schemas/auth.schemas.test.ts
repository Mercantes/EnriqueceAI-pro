import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './auth.schemas';

describe('signUpSchema', () => {
  it('should accept valid input', () => {
    const result = signUpSchema.safeParse({
      name: 'João Silva',
      email: 'joao@example.com',
      password: 'senhaforte123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short name', () => {
    const result = signUpSchema.safeParse({
      name: 'J',
      email: 'joao@example.com',
      password: 'senhaforte123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = signUpSchema.safeParse({
      name: 'João',
      email: 'invalid',
      password: 'senhaforte123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = signUpSchema.safeParse({
      name: 'João',
      email: 'joao@example.com',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('should accept valid input', () => {
    const result = signInSchema.safeParse({
      email: 'joao@example.com',
      password: 'qualquersenha',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const result = signInSchema.safeParse({
      email: 'joao@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = signInSchema.safeParse({
      email: 'not-email',
      password: 'senha123',
    });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('should accept valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'joao@example.com' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('should accept matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'novasenha123',
      confirmPassword: 'novasenha123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'novasenha123',
      confirmPassword: 'outrasenha',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = resetPasswordSchema.safeParse({
      password: '1234567',
      confirmPassword: '1234567',
    });
    expect(result.success).toBe(false);
  });
});
