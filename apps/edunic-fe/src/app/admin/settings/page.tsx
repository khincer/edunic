'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { useSchool } from '@/lib/school';
import { ButtonLink } from '@/components/button';
import { Card } from '@/components/card';
import {
  apiRequest,
  formatDate,
  type ApiSingleResponse,
  type Institution,
} from '@/lib/api';

export default function SchoolSettingsPage() {
  const { school } = useSchool();
  const schoolId = school?.id ?? '';
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
        setInstitution(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el colegio');
      } finally {
        setLoading(false);
      }
    }

    void loadInstitution();
  }, [schoolId]);

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración del colegio</p>
          <h1 className="page-title">
            {institution?.name ?? (loading ? 'Cargando colegio…' : 'Colegio')}
          </h1>
        </div>
        <div className="button-row">
          <ButtonLink href="/admin/settings/edit" variant="secondary">
            Editar
          </ButtonLink>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}

      {institution ? (
        <section className="grid grid-2">
          <Card>
            <h2 className="section-title">Detalles</h2>
            <div className="timeline-list section-stack">
              <div className="timeline-row">
                <span>Nombre</span>
                <strong>{institution.name}</strong>
              </div>
              <div className="timeline-row">
                <span>Nombre del remitente</span>
                <strong>{institution.senderName || 'Sin definir'}</strong>
              </div>
              <div className="timeline-row">
                <span>Correo de respuesta</span>
                <strong className="break-value">{institution.replyToEmail || 'Sin definir'}</strong>
              </div>
              <div className="timeline-row">
                <span>Creado</span>
                <strong>{formatDate(institution.createdAt)}</strong>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="section-title">Configuración</h2>
            <p className="body-copy">
              Extensiones, funcionalidades y el registro de auditoría de este colegio.
            </p>
            <div className="button-row">
              <ButtonLink href="/admin/settings/extensions" variant="secondary">
                Extensiones
              </ButtonLink>
              <ButtonLink href="/admin/settings/feature-flags" variant="secondary">
                Funcionalidades
              </ButtonLink>
              <ButtonLink href="/admin/settings/audit-logs" variant="secondary">
                Registro de auditoría
              </ButtonLink>
            </div>
          </Card>
        </section>
      ) : null}

    </AdminShell>
  );
}
