import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';

/**
 * Backend principal de AWS Amplify (Gen 2).
 * Conecta la capa de datos (AppSync + DynamoDB) gestionada mediante infraestructura como código.
 */
defineBackend({
  data,
});

