import { ExpressGateway } from 'express-gateway';
export declare type RealmConfig = {
    in: 'body' | 'header' | 'query' | 'routeParam';
    key: string;
};
export interface IKeycloakPluginSettings {
    realm?: RealmConfig;
    session?: any;
    keycloakConfig?: any;
}
export declare const defaultRealmConfig: RealmConfig;
export declare const DefaultKeycloakPluginSettings: IKeycloakPluginSettings;
export default class KeycloakPlugin implements ExpressGateway.Plugin {
    version: string;
    policies: string[];
    init: (ctx: ExpressGateway.PluginContext) => void;
    readonly schema: {
        $id: string;
        type: string;
        properties: {
            session: {
                title: string;
                description: string;
                type: string;
            };
            keycloakConfig: {
                title: string;
                description: string;
                type: string;
            };
        };
    };
    private getRealmName;
}
