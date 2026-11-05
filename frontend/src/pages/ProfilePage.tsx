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
  const [profileAttempt, setProfileAttempt] = useState(0);

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
    let active = true;
    async function loadData() {
      setLoadingProfile(true);
      setLoadingMembers(true);
      setProfileError(null);

      // Cargar Perfil
      try {
        const data = await getElderProfile();
        if (!active) return;
        setProfile(data);
        setName(data.name);
        setBirthDecade(data.birth_decade);
        setInterestsText((data.interests || []).join(", "));
        setProfileNotFound(false);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.code === "elder_profile_not_found") {
          setProfile(null);
          setProfileNotFound(true);
        } else {
          setProfileError(err instanceof ApiError ? err.message : "No pudimos cargar el perfil.");
        }
      } finally {
        if (active) setLoadingProfile(false);
      }

      if (!active) return;
      // Cargar Miembros e Invitaciones
      try {
        const membersRes = await getFamilyMembers();
        if (!active) return;
        setMembers(membersRes.items || []);

        if (isCuidador) {
          const invRes = await getInvitations();
          if (!active) return;
          setInvitations(invRes.items || []);
        }
      } catch {
        // Manejo silencioso
      } finally {
        if (active) setLoadingMembers(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [currentUser, isCuidador, profileAttempt]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCuidador || savingProfile) return;

    setProfileError(null);
    setProfileSuccess(null);

    const interestsArray = interestsText
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 0);

    if (!name.trim() || Array.from(name.trim()).length > 100) {
      setProfileError("Escribe un nombre o apodo de 1 a 100 caracteres.");
      return;
    }
    if (interestsArray.length > 20) {
      setProfileError("Agrega hasta 20 intereses, separados por comas.");
      return;
    }
    if (interestsArray.some((interest) => Array.from(interest).length > 100)) {
      setProfileError("Cada interés puede tener hasta 100 caracteres.");
      return;
    }
    setSavingProfile(true);

    try {
      const updated = await updateElderProfile({
        name: name.trim(),
        birth_decade: Number(birthDecade),
        interests: interestsArray,
      });
      setProfile(updated);
      setName(updated.name);
      setBirthDecade(updated.birth_decade);
      setInterestsText(updated.interests.join(", "));
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
      <div className="bg-ayni-softGreen p-6 rounded-3xl border border-ayni-green/20 text-center relative">
        <div className="w-20 h-20 mx-auto rounded-full bg-white border-2 border-ayni-green flex items-center justify-center text-3xl shadow-xs">
          👵
        </div>
        <h2 className="text-xl font-bold text-ayni-green mt-3">
          {profile ? profile.name : loadingProfile ? "Cargando..." : profileNotFound ? "Perfil incompleto" : "Perfil del familiar"}
        </h2>
        <p className="text-xs text-gray-600">
          {profile ? `Década de ${profile.birth_decade}s` : "Registra la información del adulto mayor"}
        </p>
      </div>

      {/* Formulario Perfil */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <h3 className="text-sm font-bold text-ayni-green flex items-center gap-2">
            <span>👤</span> Perfil del Adulto Mayor
          </h3>
          {!isCuidador && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm font-medium">
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

            {profileNotFound && !isCuidador && (
              <p className="text-xs text-gray-600">
                Pide a quien cuida principalmente que complete el perfil de tu familiar.
              </p>
            )}

            {profileError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs">
                ⚠️ {profileError}
                {!profile && !profileNotFound && (
                  <button type="button" className="block mt-2 underline"
                    onClick={() => setProfileAttempt((attempt) => attempt + 1)}>
                    Volver a intentar
                  </button>
                )}
              </div>
            )}

            {profileSuccess && (
              <div role="status" className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-xs">
                ✅ {profileSuccess}
              </div>
            )}

            {isCuidador && (profile !== null || profileNotFound) ? (
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <div>
                  <label htmlFor="elder-name" className="block text-xs font-semibold text-gray-700 mb-1">Nombre o Apodo</label>
                  <input
                    id="elder-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => { setName(e.target.value); setProfileSuccess(null); }}
                    placeholder="Ej. Mamá Elena"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <div>
                  <label htmlFor="elder-birth-decade" className="block text-xs font-semibold text-gray-700 mb-1">Década de Nacimiento</label>
                  <select
                    id="elder-birth-decade"
                    value={birthDecade}
                    onChange={(e) => { setBirthDecade(Number(e.target.value)); setProfileSuccess(null); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0D7A5F] bg-white"
                  >
                    <option value={1930}>Década de 1930</option>
                    <option value={1940}>Década de 1940</option>
                    <option value={1950}>Década de 1950</option>
                    <option value={1960}>Década de 1960</option>
                    <option value={1970}>Década de 1970</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="elder-interests" className="block text-xs font-semibold text-gray-700 mb-1">
                    Intereses y Gustos (separados por comas)
                  </label>
                  <input
                    id="elder-interests"
                    type="text"
                    value={interestsText}
                    onChange={(e) => { setInterestsText(e.target.value); setProfileSuccess(null); }}
                    placeholder="Ej. música, jardinería, boleros"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0D7A5F]"
                  />
                </div>

                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Guardando..." : "Guardar Perfil"}
                </Button>
              </form>
            ) : !isCuidador && (
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
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-ayni-green flex items-center gap-2">
          <span>👥</span> Miembros de la Familia
        </h3>

        {loadingMembers ? (
          <p className="text-xs text-gray-500 text-center py-2">Cargando miembros...</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex justify-between items-center p-3 bg-ayni-lightBg rounded-xl border border-ayni-green/10 text-xs">
                <div>
                  <p className="font-bold text-gray-800">{m.name}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{m.role.replace("_", " ")}</p>
                </div>
                <span className="text-[10px] bg-ayni-softGreen text-ayni-green px-2 py-1 rounded-sm font-bold">Activo</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitaciones (Solo Cuidador Principal) */}
      {isCuidador && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-ayni-green flex items-center gap-2">
            <span>✉️</span> Invitar Familiar
          </h3>

          <form onSubmit={handleCreateInvitation} className="flex gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="familiar@example.com"
              className="flex-1 px-3 py-2 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0D7A5F]"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-ayni-green text-white font-bold text-xs rounded-xl hover:bg-[#0A624C]"
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
              <p className="text-xs font-mono bg-white p-2 rounded-sm border border-[#D97706]/20 select-all font-bold">
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

