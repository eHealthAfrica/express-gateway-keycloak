import { ExpressGateway } from 'express-gateway';
export interface IKeycloakPluginSettings {
    session?: any;
    keycloakConfig?: any;
}
export declare const DefaultKeycloakPluginSettings: IKeycloakPluginSettings;
export declare const KeycloakPlugin: ExpressGateway.Plugin;
export default KeycloakPlugin;
