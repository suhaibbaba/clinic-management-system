import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { parseCoordinates, type ResolvedLocation } from '@clinic/shared';

@Injectable()
export class MapLinkResolver {
  private static readonly HOSTS = new Set([
    'maps.app.goo.gl',
    'goo.gl',
    'g.co',
    'maps.google.com',
    'www.google.com',
    'google.com',
    'maps.apple.com',
    'www.openstreetmap.org',
    'openstreetmap.org',
  ]);

  private static readonly MAX_HOPS = 5;
  private static readonly TIMEOUT_MS = 5000;

  async resolve(url: string): Promise<ResolvedLocation> {
    let current = this.checked(url);

    for (let hop = 0; hop < MapLinkResolver.MAX_HOPS; hop++) {
      const here = parseCoordinates(current.toString());

      if (here) {
        return here;
      }

      const next = await this.hop(current);

      if (!next) {
        break;
      }

      current = this.checked(next, current);
    }

    throw new UnprocessableEntityException('No coordinates could be read from that link');
  }

  /** One redirect, header only. */
  private async hop(url: URL): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MapLinkResolver.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { accept: 'text/html' },
      });

      return response.headers.get('location');
    } catch {
      throw new UnprocessableEntityException('That link could not be reached');
    } finally {
      clearTimeout(timeout);
    }
  }

  private checked(value: string, base?: URL): URL {
    let url: URL;

    try {
      url = base ? new URL(value, base) : new URL(value);
    } catch {
      throw new UnprocessableEntityException('Not a link');
    }

    if (url.protocol !== 'https:' || !MapLinkResolver.HOSTS.has(url.hostname.toLowerCase())) {
      throw new UnprocessableEntityException('Only a map link can be resolved');
    }

    return url;
  }
}
