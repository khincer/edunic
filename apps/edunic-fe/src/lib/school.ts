'use client';

import { useEffect, useState } from 'react';
import { apiRequest, type ApiSingleResponse, type Institution } from './api';

/**
 * The school is a single row. The admin pages read it once and use its id for
 * the endpoints that still address a school by id; when those endpoints lose
 * the id, this hook goes away with them.
 */
export function useSchool() {
  const [school, setSchool] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const result = await apiRequest<ApiSingleResponse<Institution>>('/school-profile');

        if (active) {
          setSchool(result.data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load the school');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return { school, loading, error };
}
