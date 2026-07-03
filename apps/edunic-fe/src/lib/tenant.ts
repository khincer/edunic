export type TenantContext = {
  host: string;
  institutionId: string;
  isDevelopmentFallback: boolean;
  name: string;
  slug: string;
};

const SEEDED_TENANTS = [
  {
    aliases: [
      'central.edunic.test',
      'central.localhost',
      'central.localtest.me',
      'central.lvh.me',
      'app.central-school.test',
    ],
    institutionId: '00000000-0000-0000-0000-000000000001',
    name: 'Central School',
    slug: 'central',
  },
  {
    aliases: [
      'north.edunic.test',
      'north.localhost',
      'north.localtest.me',
      'north.lvh.me',
      'app.north-school.test',
    ],
    institutionId: '00000000-0000-0000-0000-000000000002',
    name: 'North School',
    slug: 'north',
  },
];

const DEVELOPMENT_FALLBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SLUG_HOST_SUFFIXES = ['.edunic.test', '.localhost', '.localtest.me', '.lvh.me'];

export function resolveTenantFromHost(hostValue: string): TenantContext | null {
  const host = normalizeHost(hostValue);

  if (!host) {
    return null;
  }

  const exactMatch = SEEDED_TENANTS.find(
    (tenant) => tenant.aliases.includes(host) || tenant.slug === host
  );

  if (exactMatch) {
    return toTenantContext(exactMatch, host, false);
  }

  const slug = getSlugFromHost(host);
  const slugMatch = SEEDED_TENANTS.find((tenant) => tenant.slug === slug);

  if (slugMatch) {
    return toTenantContext(slugMatch, host, false);
  }

  if (DEVELOPMENT_FALLBACK_HOSTS.has(host)) {
    const [fallbackTenant] = SEEDED_TENANTS;
    return toTenantContext(fallbackTenant, host, true);
  }

  return null;
}

export function getBrowserTenantContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  return resolveTenantFromHost(window.location.host);
}

function normalizeHost(hostValue: string) {
  const withoutProtocol = hostValue.trim().toLowerCase().replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0] ?? '';

  if (withoutPath.startsWith('[')) {
    return withoutPath.replace(/^\[/, '').replace(/\].*$/, '');
  }

  return withoutPath.replace(/:\d+$/, '');
}

function getSlugFromHost(host: string) {
  const suffix = SLUG_HOST_SUFFIXES.find((candidate) => host.endsWith(candidate));

  if (!suffix) {
    return null;
  }

  const labels = host.slice(0, -suffix.length).split('.').filter(Boolean);
  return labels.length === 1 ? labels[0] : null;
}

function toTenantContext(
  tenant: (typeof SEEDED_TENANTS)[number],
  host: string,
  isDevelopmentFallback: boolean
): TenantContext {
  return {
    host,
    institutionId: tenant.institutionId,
    isDevelopmentFallback,
    name: tenant.name,
    slug: tenant.slug,
  };
}
