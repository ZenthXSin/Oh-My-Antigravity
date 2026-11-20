export const connectionModes=['local','channels','official'];
export function connectionMode(config) {
  return config.connectionMode??(config.enabled?'channels':'official');
}
export function usesLocalGateway(config){return connectionMode(config)!=='official';}
