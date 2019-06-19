"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var logger_1 = require("express-gateway/lib/logger");
var Keycloak = require("keycloak-connect");
var session = require("express-session");
var createMemoryStore = require("memorystore");
var logger = logger_1.createLoggerWithLabel('[EG:plugin:keycloak]');
var MemoryStore = createMemoryStore(session);
exports.DefaultKeycloakPluginSettings = {
    session: {
        secret: 'kc_secret'
    }
};
exports.KeycloakPlugin = {
    version: '1.2.0',
    policies: ['keycloak-protect'],
    init: function (ctx) {
        // this is slightly dodgy casting, as they don't expose settings on the public interface - but not sure how else you can access custom settings for a plugin
        var sessionStore = new MemoryStore();
        var rawSettings = ctx.settings;
        var sessionSettings = __assign({}, exports.DefaultKeycloakPluginSettings.session, rawSettings.session, { store: sessionStore });
        var keycloakConfig = __assign({}, exports.DefaultKeycloakPluginSettings.keycloakConfig, rawSettings.keycloakConfig);
        var pluginSettings = {
            session: sessionSettings,
            keycloakConfig: keycloakConfig
        };
        var keycloak = new Keycloak({ store: sessionStore }, pluginSettings.keycloakConfig);
        logger.info("Initialized Keycloak Plugin with settings: " + JSON.stringify(pluginSettings, null, '\t'));
        keycloak.authenticated = function (req) {
            logger.info('-- Keycloak Authenticated: ' +
                JSON.stringify(req.kauth.grant.access_token.content, null, '\t'));
        };
        keycloak.accessDenied = function (req, res) {
            logger.info('-- Keycloak Access Denied');
            res.status(403).end('Access Denied');
        };
        // setup our keycloak middleware
        ctx.registerGatewayRoute(function (app) {
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
                        description: 'the keycloak token variable name to reference the token in jsProtect',
                        type: 'string'
                    },
                    jsProtect: {
                        description: 'a js snippet to apply for whether a user has access.',
                        type: 'string'
                    }
                }
            },
            policy: function (actionParams) {
                logger.info("-- Keycloak Protect: " + JSON.stringify(actionParams, null, '\t'));
                if (actionParams.jsProtect) {
                    return keycloak.protect(function (token, req) {
                        req.egContext[actionParams.jsProtectTokenVar || 'token'] = token;
                        var runResult = req.egContext.run(actionParams.jsProtect);
                        logger.info('-- Keycloak Protect JS Result: ' + runResult);
                        return runResult;
                    });
                }
                return keycloak.protect(actionParams.role);
            }
        });
    },
    schema: {
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
                description: 'This can be used rather than requiring keycloak.json to be present',
                type: 'object'
            }
        }
    }
};
exports.default = exports.KeycloakPlugin;
//# sourceMappingURL=KeycloakPlugin.js.map