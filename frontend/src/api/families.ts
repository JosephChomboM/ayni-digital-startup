import { apiFetch } from "./client";

export interface Family {
  id: string;
  name: string;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  role: "cuidador_principal" | "familiar";
}

export interface ElderProfile {
  id: string;
  family_id: string;
  name: string;
  birth_decade: number;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export interface ElderProfilePayload {
  name: string;
  birth_decade: number;
  interests: string[];
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
}

export async function getMyFamily(): Promise<Family> {
  return apiFetch<Family>("/families/me");
}

export async function getFamilyMembers(): Promise<{ items: Member[] }> {
  return apiFetch<{ items: Member[] }>("/families/me/members");
}

export async function getElderProfile(): Promise<ElderProfile> {
  return apiFetch<ElderProfile>("/families/me/elder-profile");
}

export async function updateElderProfile(payload: ElderProfilePayload): Promise<ElderProfile> {
  return apiFetch<ElderProfile>("/families/me/elder-profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getInvitations(): Promise<{ items: Invitation[] }> {
  return apiFetch<{ items: Invitation[] }>("/families/me/invitations");
}

export async function createInvitation(email: string): Promise<{ invitation: Invitation; invitation_token: string }> {
  return apiFetch<{ invitation: Invitation; invitation_token: string }>("/families/me/invitations", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  return apiFetch<void>(`/families/me/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

