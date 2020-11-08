export interface Config {
  host?: string;
  version?: number;
  apiPrefix?: string;
  mode?: 'no-cors' | 'cors' | 'same-origin',
}

const DEFAULT_CONFIG: Config = {
  host: '',
  version: 1,
  mode: 'cors',
};

interface ISDK {
  [key: string]: (params: any) => Promise<any>;
}

export const SdkFactory = (Sdk: (config: Config) => ISDK) => (config = DEFAULT_CONFIG): ISDK => {
  config.apiPrefix = config.apiPrefix || `/api/v${config.version || 1}`;
  return Sdk(config);
};
