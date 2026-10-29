'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useSchool } from '@/lib/school';
import { Button, ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function EditInstitutionPage() {
  const router = useRouter();
  const { school } = useSchool();
  const schoolId = school?.id ?? '';
  // SI-R2: the API scopes PATCH to the caller's own institution (P2 added the
  // guard), so this page is only usable for that one. For any other school we
  // show what the read API returned and no form, instead of a form whose save
  // would always fail with 403.
  const [name, setName] = useState('');
  const [senderName, setSenderName] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function loadInstitution() {
      if (!schoolId) {
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>(
          `/school-profile`
        );
        setName(result.data.name);
        setSenderName(result.data.senderName ?? '');
        setReplyToEmail(result.data.replyToEmail ?? '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el colegio');
      } finally {
        setLoading(false);
      }
    }

    void loadInstitution();
  }, [schoolId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      await apiRequest<ApiSingleResponse<Institution>>(`/school-profile`, {
        method: 'PATCH',
        body: { name, senderName, replyToEmail },
      });
      router.push(`/admin/settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el colegio');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración del colegio</p>
          <h1 className="page-title">Editar colegio</h1>
          <p className="body-copy">
            El registro del colegio debe seguir siendo reconocible; aquí también se
            define la identidad del remitente de los correos que el colegio envía a
            las familias.
          </p>
        </div>
        <ButtonLink href={`/admin/settings`} variant="secondary">
          Volver al detalle
        </ButtonLink>
      </header>

      <Card>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loading ? <p className="body-copy">Cargando colegio…</p> : null}
        {!loading ? (
          <form className="form" onSubmit={handleSubmit}>
            <FormField
              autoFocus
              label="Nombre del colegio"
              maxLength={160}
              name="name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <FormField
              help="Nombre visible para las familias como remitente. Si queda vacío, no se envían correos."
              label="Nombre del remitente"
              maxLength={120}
              name="senderName"
              onChange={(event) => setSenderName(event.target.value)}
              value={senderName}
            />
            <FormField
              help="Dirección a la que responden las familias. Si queda vacía, se usa la dirección de respuesta de la plataforma."
              label="Correo de respuesta"
              maxLength={160}
              name="replyToEmail"
              onChange={(event) => setReplyToEmail(event.target.value)}
              type="email"
              value={replyToEmail}
            />
            <div className="button-row">
              <Button disabled={busy} type="submit">
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <ButtonLink href={`/admin/settings`} variant="secondary">
                Cancelar
              </ButtonLink>
            </div>
          </form>
        ) : null}
      </Card>
    </AdminShell>
  );
}
