import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import type { User } from "../api/auth";
import {
  getElderProfile,
  updateElderProfile,
  getFamilyMembers,
  getInvitations,
  createInvitation,
  revokeInvitation,
} from "../api/families";
import type { ElderProfile, Member, Invitation } from "../api/families";
import { ApiError } from "../api/client";

interface ProfilePageProps {
  currentUser: User;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ currentUser }) => {
  const isCuidador = currentUser.role === "cuidador_principal";

  const [profile, setProfile] = useState<ElderProfile | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Formulario Perfil Adulto Mayor
  const [name, setName] = useState("");
  const [birthDecade, setBirthDecade] = useState(1950);
  const [interestsText, setInterestsText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Miembros e Invitaciones
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoadingProfile(true);
      setLoadingMembers(true);
      setProfileError(null);

      // Cargar Perfil
      try {
        const data = await getElderProfile();
        setProfile(data);
        setName(data.name);
        setBirthDecade(data.birth_decade);
        setInterestsText((data.interests || []).join(", "));
        setProfileNotFound(false);
      } catch (err) {
        if (err instanceof ApiError && err.code === "elder_profile_not_found") {
          setProfileNotFound(true);
        } else if (err instanceof ApiError) {
          setProfileError(err.message);
        }
      } finally {
        setLoadingProfile(false);
      }

      // Cargar Miembros e Invitaciones
      try {
        const membersRes = await getFamilyMembers();
        setMembers(membersRes.items || []);

        if (isCuidador) {
          const invRes = await getInvitations();
          setInvitations(invRes.items || []);
        }
      } catch {
        // Manejo silencioso
      } finally {
        setLoadingMembers(false);
      }
    }

    loadData();
  }, [currentUser, isCuidador]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCuidador) return;

    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const interestsArray = interestsText
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 0)
      .slice(0, 20);

    try {
      const updated = await updateElderProfile({
        name: name.trim(),
        birth_decade: Number(birthDecade),
        interests: interestsArray,
      });
      setProfile(updated);
      setProfileNotFound(false);
      setProfileSuccess("Perfil guardado correctamente.");
    } catch (err) {
      if (err instanceof ApiError) {
        setProfileError(err.message);
      } else {
        setProfileError("No se pudo guardar el perfil.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCuidador) return;

    setInviteError(null);
    setGeneratedToken(null);

    try {
      const res = await createInvitation(inviteEmail.trim().toLowerCase());
      setGeneratedToken(res.invitation_token);
      setInviteEmail("");
      const invRes = await getInvitations();
      setInvitations(invRes.items || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setInviteError(err.message);
      } else {
        setInviteError("No se pudo generar la invitación.");
      }
    }
  };

  const handleRevokeInvitation = async (id: string) => {
    if (!isCuidador) return;
    try {
      await revokeInvitation(id);
      const invRes = await getInvitations();
      setInvitations(invRes.items || []);
    } catch {
      alert("No se pudo revocar la invitación.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-[#E8F5E9] p-6 rounded-3xl border border-[#0D7A5F]/20 text-center relative">
        <div className="w-20 h-20 mx-auto rounded-full bg-white border-2 border-[#0D7A5F] flex items-center justify-center text-3xl shadow-sm">
          👵
        </div>
        <h2 className="text-xl font-bold text-[#0D7A5F] mt-3">
          {profile ? profile.name : profileNotFound ? "Perfil incompleto" : "Cargando..."}
        </h2>
        <p className="text-xs text-gray-600">
          {profile ? `Década de ${profile.birth_decade}s` : "Registra la información del adulto mayor"}
        </p>
      </div>

      {/* Formulario Perfil */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <h3 className="text-sm font-bold text-[#0D7A5F] flex items-center gap-2">
            <span>👤</span> Perfil del Adulto Mayor
          </h3>
          {!isCuidador && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              Solo lectura
            </span>
          )}
        </div>

        {loadingProfile ? (
          <p className="text-xs text-gray-500 text-center py-4">Cargando perfil...</p>
        ) : (
          <>
            {profileNotFound && isCuidador && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl text-xs">
                ℹ️ Completa el perfil de tu familiar para comenzar las actividades.
              </div>
            )}

            {profileError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
                ⚠️ {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs">
                ✅ {profileSuccess}
              </div>
            )}

            {isCuidador ? (
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre o Apodo</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Mamá Elena"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Década de Nacimiento</label>
                  <select
                    value={birthDecade}
                    onChange={(e) => setBirthDecade(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F] bg-white"
                  >
                    <option value={1930}>Década de 1930</option>
                    <option value={1940}>Década de 1940</option>
                    <option value={1950}>Década de 1950</option>
                    <option value={1960}>Década de 1960</option>
                    <option value={1970}>Década de 1970</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Intereses y Gustos (separados por comas)
                  </label>
                  <input
                    type="text"
                    value={interestsText}
                    onChange={(e) => setInterestsText(e.target.value)}
                    placeholder="Ej. música, jardinería, boleros"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Guardando..." : "Guardar Perfil"}
                </Button>
              </form>
            ) : (
              <div className="space-y-2 text-xs text-gray-700">
                <p><strong>Nombre:</strong> {profile?.name || "-"}</p>
                <p><strong>Década:</strong> {profile ? `${profile.birth_decade}s` : "-"}</p>
                <p><strong>Intereses:</strong> {(profile?.interests || []).join(", ") || "-"}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Miembros de la Familia */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-[#0D7A5F] flex items-center gap-2">
          <span>👥</span> Miembros de la Familia
        </h3>

        {loadingMembers ? (
          <p className="text-xs text-gray-500 text-center py-2">Cargando miembros...</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex justify-between items-center p-3 bg-[#F4FBF7] rounded-xl border border-[#0D7A5F]/10 text-xs">
                <div>
                  <p className="font-bold text-gray-800">{m.name}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{m.role.replace("_", " ")}</p>
                </div>
                <span className="text-[10px] bg-[#E8F5E9] text-[#0D7A5F] px-2 py-1 rounded font-bold">Activo</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitaciones (Solo Cuidador Principal) */}
      {isCuidador && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-[#0D7A5F] flex items-center gap-2">
            <span>✉️</span> Invitar Familiar
          </h3>

          <form onSubmit={handleCreateInvitation} className="flex gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="familiar@example.com"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D7A5F]"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-[#0D7A5F] text-white font-bold text-xs rounded-xl hover:bg-[#0A624C]"
            >
              Invitar
            </button>
          </form>

          {inviteError && (
            <p className="text-xs text-red-600 font-medium">⚠️ {inviteError}</p>
          )}

          {generatedToken && (
            <div className="bg-[#FEF3C7] border border-[#D97706]/30 p-3 rounded-xl space-y-1">
              <p className="text-xs font-bold text-[#92400E]">Código de invitación generado:</p>
              <p className="text-xs font-mono bg-white p-2 rounded border border-[#D97706]/20 select-all font-bold">
                {generatedToken}
              </p>
              <p className="text-[10px] text-[#92400E]/80">
                Copia y comparte este código directamente con tu familiar. Vence en 72 horas.
              </p>
            </div>
          )}

          {invitations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-700">Invitaciones pendientes:</p>
              {invitations.map((inv) => (
                <div key={inv.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-xs">
                  <div>
                    <p className="font-medium text-gray-800">{inv.email}</p>
                    <p className="text-[10px] text-gray-400">Estado: {inv.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Revocar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

