import { headers } from 'next/headers';
import { resolveTenantFromHost } from './tenant';

export async function getRequestTenantContext() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') ??
    requestHeaders.get('host') ??
    '';

  return resolveTenantFromHost(host);
}
