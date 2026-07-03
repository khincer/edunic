'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, ButtonLink } from '@/components/button';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { FormField } from '@/components/form-field';
import {
  apiRequest,
  buildQuery,
  formatDate,
  type ApiListResponse,
  type Institution,
} from '@/lib/api';

const PAGE_SIZE = 10;

export default function InstitutionsPage() {
  const router = useRouter();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setSearch(query.get('search') ?? '');
    setOffset(Number(query.get('offset') ?? 0));
    setSortBy(query.get('sortBy') === 'name' ? 'name' : 'createdAt');
    setSortOrder(query.get('sortOrder') === 'asc' ? 'asc' : 'desc');
  }, []);

  useEffect(() => {
    async function loadInstitutions() {
      setLoading(true);
      setError('');

      try {
        const query = buildQuery({
          search,
          limit: PAGE_SIZE,
          offset,
          sortBy,
          sortOrder,
        });
        const result = await apiRequest<ApiListResponse<Institution>>(`/institutions${query}`);
        setInstitutions(result.data);
        setTotal(result.meta.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load institutions');
      } finally {
        setLoading(false);
      }
    }

    void loadInstitutions();
  }, [offset, search, sortBy, sortOrder]);

  const columns = useMemo<DataTableColumn<Institution>[]>(
    () => [
      {
        key: 'name',
        header: 'Institution',
        render: (institution) => (
          <Link href={`/admin/institutions/${institution.id}`}>
            <strong>{institution.name}</strong>
            <p className="field-help">{institution.id}</p>
          </Link>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (institution) => formatDate(institution.createdAt),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'right',
        render: (institution) => (
          <div className="table-actions">
            <ButtonLink href={`/admin/institutions/${institution.id}`} variant="secondary">
              Open
            </ButtonLink>
          </div>
        ),
      },
    ],
    []
  );

  function syncRoute(next: {
    search?: string;
    offset?: number;
    sortBy?: 'createdAt' | 'name';
    sortOrder?: 'asc' | 'desc';
  }) {
    const nextSearch = next.search ?? search;
    const nextOffset = next.offset ?? offset;
    const nextSortBy = next.sortBy ?? sortBy;
    const nextSortOrder = next.sortOrder ?? sortOrder;
    router.replace(
      `/admin/institutions${buildQuery({
        search: nextSearch,
        offset: nextOffset,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      })}`
    );
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    syncRoute({ offset: 0 });
  }

  function changeSort(nextSortBy: 'createdAt' | 'name') {
    const nextSortOrder = sortBy === nextSortBy && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setOffset(0);
    syncRoute({ offset: 0, sortBy: nextSortBy, sortOrder: nextSortOrder });
  }

  function changePage(nextOffset: number) {
    setOffset(nextOffset);
    syncRoute({ offset: nextOffset });
  }

  const canGoBack = offset > 0;
  const canGoForward = offset + PAGE_SIZE < total;

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <p className="eyebrow">Institutions</p>
          <h1 className="page-title">Manage schools</h1>
          <p className="body-copy">
            Search, create, rename, and open institution-scoped operations.
          </p>
        </div>
        <ButtonLink href="/admin/institutions/new">New institution</ButtonLink>
      </header>

      <section className="card filter-panel">
        <form className="grid grid-2" onSubmit={handleSearch}>
          <FormField
            label="Search"
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Institution name"
            type="search"
            value={search}
          />
          <div className="button-row form-action-row">
            <Button type="submit">Apply search</Button>
            <Button onClick={() => changeSort('name')} variant="secondary">
              Sort name {sortBy === 'name' ? sortOrder : ''}
            </Button>
            <Button onClick={() => changeSort('createdAt')} variant="secondary">
              Sort created {sortBy === 'createdAt' ? sortOrder : ''}
            </Button>
          </div>
        </form>
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="empty-state body-copy">Loading institutions...</div> : null}
      {!loading ? (
        <DataTable
          columns={columns}
          emptyMessage="No institutions match this search."
          getRowKey={(institution) => institution.id}
          rows={institutions}
        />
      ) : null}

      <div className="page-header pager-row">
        <p className="field-help">
          Showing {institutions.length} of {total} institutions
        </p>
        <div className="button-row">
          <Button
            disabled={!canGoBack}
            onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
            variant="secondary"
          >
            Previous
          </Button>
          <Button
            disabled={!canGoForward}
            onClick={() => changePage(offset + PAGE_SIZE)}
            variant="secondary"
          >
            Next
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}
