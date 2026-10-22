import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Esquema de datos para Festival Control.
 * Cada modelo 'a.model' aprovisiona automáticamente una tabla en Amazon DynamoDB
 * y genera una API GraphQL (AWS AppSync) con resolvers optimizados.
 */
const schema = a.schema({
  FestivalEvent: a
    .model({
      artist: a.string().required(),
      space: a.string().required(),
      time: a.string().required(),
      status: a.enum(['CONFIRMED', 'DELAYED', 'CANCELLED']),
    })
    .authorization((allow) => [
      // Permite acceso público mediante API Key para que la aplicación web pueda consultar y modificar eventos
      allow.publicApiKey(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});

