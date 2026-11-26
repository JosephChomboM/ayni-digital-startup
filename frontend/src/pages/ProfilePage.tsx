import { PageIntro } from "../components/PageIntro";
import React, { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { UserRound, ImagePlus, Trash2 } from "lucide-react";
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
import { deleteLocalFamilyProfilePhoto, getLocalFamilyProfilePhoto, saveLocalFamilyProfilePhoto } from "../api/localMedia";

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
  const [membersError, setMembersError] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const [photoRefresh, setPhotoRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getLocalFamilyProfilePhoto(currentUser.family_id).then((blob) => {
      if (active && blob) {
        objectUrl = URL.createObjectURL(blob);
        setProfilePhotoUrl(objectUrl);
      } else if (active) setProfilePhotoUrl(null);
    }).catch(() => { if (active) setProfilePhotoError("No se pudo cargar la foto. Puedes intentar seleccionarla otra vez."); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [currentUser.family_id, photoRefresh]);

  const handleProfilePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfilePhotoError("Elige una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProfilePhotoError("La foto debe pesar menos de 8 MB.");
      return;
    }
    try {
      await saveLocalFamilyProfilePhoto(currentUser.family_id, file);
      setProfilePhotoError(null);
      setPhotoRefresh(value => value + 1);
    } catch {
      setProfilePhotoError("No pudimos guardar la foto en este navegador.");
    }
  };

  const handleRemoveProfilePhoto = async () => {
    try {
      await deleteLocalFamilyProfilePhoto(currentUser.family_id);
      setProfilePhotoError(null);
      setPhotoRefresh(value => value + 1);
    } catch {
      setProfilePhotoError("No pudimos quitar la foto. Inténtalo otra vez.");
    }
  };

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoadingProfile(true);
      setLoadingMembers(true);
      setMembersError(false);
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
        if (active) setMembersError(true);
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
    <div className="profile-page space-y-6">
      <PageIntro eyebrow="NUESTRA HISTORIA EN FAMILIA" title="Perfil familiar">Un espacio para conocer sus gustos y a las personas que la acompañan.</PageIntro>
      {/* Encabezado */}
      <div className="profile-banner">
        <div className="profile-avatar-wrap">
          {profilePhotoUrl ? <img src={profilePhotoUrl} alt={`Foto de ${profile?.name || "tu familiar"}`} className="profile-avatar-image" /> : <UserRound className="profile-avatar-placeholder" aria-hidden="true" />}
          {isCuidador && <label className="profile-photo-action" htmlFor="family-profile-photo" title={profilePhotoUrl ? "Cambiar foto" : "Agregar foto"}><ImagePlus size={18} aria-hidden="true"/><span className="sr-only">{profilePhotoUrl ? "Cambiar foto del familiar" : "Agregar foto del familiar"}</span></label>}
        </div>
        <div className="profile-banner-copy">
          <p className="profile-banner-kicker">LA PERSONA QUE ACOMPAÑAMOS</p>
          <h2>{profile ? profile.name : loadingProfile ? "Cargando..." : profileNotFound ? "Perfil incompleto" : "Perfil del familiar"}</h2>
          <p>{profile ? `Década de ${profile.birth_decade}s` : "Un espacio para conocer sus gustos y compartir en familia."}</p>
          {isCuidador && <div className="profile-photo-tools"><label htmlFor="family-profile-photo">{profilePhotoUrl ? "Cambiar foto" : "Agregar una foto"}</label>{profilePhotoUrl && <button type="button" onClick={handleRemoveProfilePhoto}><Trash2 size={14} aria-hidden="true"/> Quitar</button>}<small>La foto queda guardada en este navegador.</small></div>}
          <input id="family-profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfilePhoto} disabled={!isCuidador}/>
          {profilePhotoError && <p className="profile-photo-error" role="alert">{profilePhotoError}</p>}
        </div>
        <div className="profile-banner-aside" aria-label="Gustos para iniciar conversaciones">
          <p>PISTAS PARA CONVERSAR</p>
          <h3>Lo que disfruta también cuenta.</h3>
          {profile?.interests?.length ? <div className="profile-interest-chips">{profile.interests.slice(0, 5).map(interest => <span key={interest}>{interest}</span>)}</div> : <span className="profile-banner-hint">Agrega sus gustos para inspirar preguntas más cercanas en la guía.</span>}
        </div>
      </div>

      <div className="profile-workspace">
      <section className="profile-panel profile-edit-panel space-y-4" aria-labelledby="elder-profile-heading">
        <div className="profile-section-heading">
          <span>01</span><div><h3 id="elder-profile-heading">Sus datos y gustos</h3><p>Completa solo lo que ayude a preparar conversaciones significativas.</p></div>
          {!isCuidador && (
            <span className="profile-readonly-label">
              Solo lectura
            </span>
          )}
        </div>

        {loadingProfile ? (
          <p className="text-xs text-gray-500 text-center py-4">Cargando perfil...</p>
        ) : (
          <>
            {profileNotFound && isCuidador && (
              <div className="profile-inline-notice">
                Completa el perfil de tu familiar para comenzar las actividades.
              </div>
            )}

            {profileNotFound && !isCuidador && (
              <p className="text-xs text-gray-600">
                Pide a quien cuida principalmente que complete el perfil de tu familiar.
              </p>
            )}

            {profileError && (
              <div role="alert" className="profile-error-notice">
                {profileError}
                {!profile && !profileNotFound && (
                  <button type="button" className="block mt-2 underline"
                    onClick={() => setProfileAttempt((attempt) => attempt + 1)}>
                    Volver a intentar
                  </button>
                )}
              </div>
            )}

            {profileSuccess && (
              <div role="status" className="profile-success-notice">
                {profileSuccess}
              </div>
            )}

            {isCuidador && (profile !== null || profileNotFound) ? (
              <form onSubmit={handleSaveProfile} className="profile-fields">
                <div className="profile-field profile-field-wide">
                  <label htmlFor="elder-name">Nombre o apodo</label>
                  <input
                    id="elder-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => { setName(e.target.value); setProfileSuccess(null); }}
                    placeholder="Ej. Mamá Elena"
                    className="profile-input"
                  />
                </div>

                <div className="profile-field">
                  <label htmlFor="elder-birth-decade">Década de nacimiento</label>
                  <select
                    id="elder-birth-decade"
                    value={birthDecade}
                    onChange={(e) => { setBirthDecade(Number(e.target.value)); setProfileSuccess(null); }}
                    className="profile-input"
                  >
                    <option value={1930}>Década de 1930</option>
                    <option value={1940}>Década de 1940</option>
                    <option value={1950}>Década de 1950</option>
                    <option value={1960}>Década de 1960</option>
                    <option value={1970}>Década de 1970</option>
                  </select>
                </div>

                <div className="profile-field profile-field-wide">
                  <label htmlFor="elder-interests">Intereses y gustos <span>Sepáralos con comas</span></label>
                  <input
                    id="elder-interests"
                    type="text"
                    value={interestsText}
                    onChange={(e) => { setInterestsText(e.target.value); setProfileSuccess(null); }}
                    placeholder="Ej. música, jardinería, boleros"
                    className="profile-input"
                  />
                </div>

                <Button type="submit" disabled={savingProfile} className="profile-save-button">
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
      </section>

      {/* Miembros de la Familia */}
      <div className="profile-family-column">
      <section className="profile-panel profile-members-panel space-y-3" aria-labelledby="family-members-heading">
        <div className="profile-section-heading"><span>02</span><div><h3 id="family-members-heading">Quienes están cerca</h3><p>Las personas que forman parte de este espacio.</p></div></div>

        {membersError && <div role="alert" className="space-y-2 text-sm text-red-700"><p>No pudimos consultar todos los miembros o invitaciones de tu familia.</p><button type="button" onClick={() => setProfileAttempt(value => value + 1)} className="min-h-11 underline">Volver a intentar</button></div>}
        {loadingMembers ? (
          <p className="text-xs text-gray-500 text-center py-2">Cargando miembros...</p>
        ) : (
          <div className="profile-member-list">
            {!membersError && members.length === 0 && <p className="text-sm text-gray-600">Todavía no hay miembros para mostrar.</p>}
            {members.map((m) => (
              <div key={m.id} className="profile-member-row">
                <span className="profile-member-initial" aria-hidden="true">{m.name.trim().charAt(0).toLocaleUpperCase()}</span><div>
                  <p>{m.name}{m.id === currentUser.id && <span className="profile-you-label">Tú</span>}</p>
                  <p className="profile-member-role">{m.role === "cuidador_principal" ? "Cuidador principal" : "Familiar colaborador"}</p>
                </div>
                <span className="profile-member-status"><i aria-hidden="true"/>Activo</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invitaciones (Solo Cuidador Principal) */}
      {isCuidador && (
        <section className="profile-panel profile-invite-panel space-y-3" aria-labelledby="invite-family-heading">
          <div className="profile-section-heading"><span>03</span><div><h3 id="invite-family-heading">Sumar a alguien más</h3><p>Invita a un familiar para compartir recuerdos y acompañar.</p></div></div>

          <form onSubmit={handleCreateInvitation} className="profile-invite-form">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              aria-label="Correo electrónico del familiar"
              placeholder="familiar@example.com"
              className="profile-input"
            />
            <button type="submit">Invitar familiar <span aria-hidden="true">→</span></button>
          </form>

          {inviteError && (
            <p className="text-xs text-red-600 font-medium">{inviteError}</p>
          )}

          {generatedToken && (
            <div className="profile-invitation-code">
              <p>Código de invitación</p>
              <p>
                {generatedToken}
              </p>
              <p>
                Compártelo con tu familiar. Vence en 72 horas.
              </p>
            </div>
          )}

          {invitations.length > 0 && (
            <div className="profile-pending-invitations">
              <p>Invitaciones pendientes</p>
              {invitations.map((inv) => (
                <div key={inv.id} className="profile-invitation-row">
                  <div>
                    <p>{inv.email}</p>
                    <p>Estado: {inv.status}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="profile-revoke-button"
                  >
                    Revocar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>
      </div>
    </div>
  );
};

