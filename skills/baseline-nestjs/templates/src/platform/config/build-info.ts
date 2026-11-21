import { readFileSync } from 'node:fs';

import { z } from 'zod';

const BuildInfo = z.object({ commit: z.string().min(1) });
export type BuildInfo = z.output<typeof BuildInfo>;

/**
 * The commit the image build wrote to dist/build-info.json (NEST-REL-06); `unknown` where no image build ran
 * (watch mode, tests). The release version is configuration (RELEASE_VERSION), not part of the image.
 */
export function readBuildInfo(file: URL): BuildInfo {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { commit: 'unknown' };
  }
  const parsed = BuildInfo.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`Invalid build-info.json: ${file.pathname}`);
  return parsed.data;
}
