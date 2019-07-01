import { Request, RequestHandler, Response } from 'express';

import { ExpressGateway } from 'express-gateway';
import Keycloak from 'keycloak-connect-multirealm';
import { createLoggerWithLabel } from 'express-gateway/lib/logger';
import createMemoryStore from 'memorystore';
import session from 'express-session';

const logger = createLoggerWithLabel('[EG:plugin:keycloak]');

const MemoryStore = createMemoryStore(session);

export type RealmConfig = {
  in: 'body' | 'header' | 'query' | 'routeParam';
  key: string;
};

export interface IKeycloakPluginSettings {
  realm?: RealmConfig;
  session?: any;
  keycloakConfig?: any;
}

export const defaultRealmConfig: RealmConfig = {
  in: 'routeParam',
  key: 'realm'
};

export const DefaultKeycloakPluginSettings: IKeycloakPluginSettings = {
  session: {
    secret: 'kc_secret'
  },
  realm: defaultRealmConfig
};

export default class KeycloakPlugin implements ExpressGateway.Plugin {
  version: string = '1.2.0';
  policies: string[] = ['keycloak-protect'];

  init = (ctx: ExpressGateway.PluginContext) => {
    // this is slightly dodgy casting, as they don't expose settings on the public interface - but not sure how else you can access custom settings for a plugin
    const sessionStore = new MemoryStore();
    const rawSettings: IKeycloakPluginSettings = (ctx as any).settings;
    const sessionSettings = {
      ...DefaultKeycloakPluginSettings.session,
      ...rawSettings.session,
      store: sessionStore
    };
    const keycloakConfig = {
      ...DefaultKeycloakPluginSettings.keycloakConfig,
      ...rawSettings.keycloakConfig
    };
    const realmConfig: RealmConfig = rawSettings.realm as RealmConfig;
    const pluginSettings: IKeycloakPluginSettings = {
      realm: realmConfig,
      session: sessionSettings,
      keycloakConfig: keycloakConfig
    };
    const keycloak = new Keycloak(
      { store: sessionStore },
      pluginSettings.keycloakConfig
    );

    logger.info(
      `Initialized Keycloak Plugin with settings: ${JSON.stringify(
        pluginSettings,
        null,
        '\t'
      )}`
    );

    keycloak.authenticated = (req: Request) => {
      logger.info(
        '-- Keycloak Authenticated: ' +
          JSON.stringify(
            (req as any).kauth.grant.access_token.content,
            null,
            '\t'
          )
      );
    };

    keycloak.accessDenied = (_req: Request, res: Response) => {
      logger.info('-- Keycloak Access Denied');
      res.status(403).end('Access Denied');
    };

    keycloak.getRealmNameFromRequest = (req: Request) => {
      return this.getRealmName(req, realmConfig);
    };

    // setup our keycloak middleware
    ctx.registerGatewayRoute(app => {
      logger.info('Registering Keycloak Middleware');
      app.use(session(pluginSettings.session));
      app.use(keycloak.middleware());
    });

    ctx.registerPolicy({
      name: 'keycloak-protect',
      schema: {
        $id: 'http://express-gateway.io/schemas/policies/keycloak-protect.json',
        type: 'object',
        properties: {
          role: {
            description: 'the keycloak role to restrict access to',
            type: 'string'
          },
          jsProtectTokenVar: {
            description:
              'the keycloak token variable name to reference the token in jsProtect',
            type: 'string'
          },
          jsProtect: {
            description: 'a js snippet to apply for whether a user has access.',
            type: 'string'
          }
        }
      },
      policy: (actionParams: any): RequestHandler => {
        logger.info(
          `-- Keycloak Protect: ${JSON.stringify(actionParams, null, '\t')}`
        );
        if (actionParams.jsProtect) {
          return keycloak.protect((token, req) => {
            req.egContext[actionParams.jsProtectTokenVar || 'token'] = token;
            const runResult = req.egContext.run(actionParams.jsProtect);
            logger.info('-- Keycloak Protect JS Result: ' + runResult);
            return runResult;
          });
        }
        return keycloak.protect(actionParams.role);
      }
    });
  };

  get schema() {
    return {
      $id: 'http://express-gateway.io/schemas/plugin/keycloak.json',
      type: 'object',
      properties: {
        session: {
          title: 'Session Settings',
          description: 'Session Settings as outlined by express middleware',
          type: 'object'
        },
        keycloakConfig: {
          title: 'Keycloak Configuration',
          description:
            'This can be used rather than requiring keycloak.json to be present',
          type: 'object'
        }
      }
    };
  }

  private getRealmName = (req: Request, realmConfig: RealmConfig): string => {
    let realm: string;

    switch (realmConfig.in) {
      case 'routeParam':
        realm = (req.params[realmConfig.key] || '').toString();
        break;
      case 'header':
        realm = (req.get(realmConfig.key) || '').toString();
        break;
      case 'query':
        realm = (req.query[realmConfig.key] || '').toString();
        break;
      case 'body':
        realm = (req.body ? req.body[realmConfig.key] || '' : '').toString();
        break;
      default:
        logger.info(`Path "${req.path}" does not specify a Keycloak realm`);
        realm = '';
    }

    logger.info(`params: ${req.params} ... extracted realm: ${realm}`);
    return realm;
  };
}
