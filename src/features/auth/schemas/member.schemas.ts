import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['manager', 'sdr'], { message: 'Role deve ser manager ou sdr' }),
});

export const updateMemberStatusSchema = z.object({
  memberId: z.string().uuid('ID de membro inválido'),
  status: z.enum(['active', 'suspended'], { message: 'Status deve ser active ou suspended' }),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid('ID de membro inválido'),
  role: z.enum(['manager', 'sdr'], { message: 'Role deve ser manager ou sdr' }),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
