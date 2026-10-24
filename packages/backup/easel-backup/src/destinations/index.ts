import { BackupError } from '../errors.js';
import type { Destination, DestinationConfig, DestinationSecrets } from '../types.js';
import { FsDestination } from './fs.js';
import { S3Destination } from './s3.js';
import { WebDavDestination } from './webdav.js';

/**
 * Build the destination implementation matching a config/secrets pair.
 * @param config - Protocol and addressing.
 * @param secrets - Secret material; its protocol must match the config's.
 * @returns The destination seam.
 * @throws {@link BackupError} with code `CONFIG` when the pair disagrees.
 */
export function createDestination(config: DestinationConfig, secrets: DestinationSecrets): Destination {
  if (config.protocol !== secrets.protocol) {
    throw new BackupError('CONFIG', `目标端协议 ${config.protocol} 与凭据协议 ${secrets.protocol} 不一致`);
  }
  switch (config.protocol) {
    case 'smb':
      return new FsDestination(config.root);
    case 'webdav': {
      const { password } = secrets as Extract<DestinationSecrets, { protocol: 'webdav' }>;
      return new WebDavDestination({ ...config, password });
    }
    case 's3': {
      const keys = secrets as Extract<DestinationSecrets, { protocol: 's3' }>;
      return new S3Destination({
        endpoint: config.endpoint ?? '',
        region: config.region,
        bucket: config.bucket,
        pathStyle: config.pathStyle,
        accessKeyId: keys.accessKeyId,
        secretAccessKey: keys.secretAccessKey,
      });
    }
    default: {
      const exhaustive: never = config;
      throw new BackupError('CONFIG', `不支持的目标端协议：${JSON.stringify(exhaustive)}`);
    }
  }
}
