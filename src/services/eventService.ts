import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import outputs from '../../amplify_outputs.json';
import { FestivalEvent, EventStatus, initialEvents } from '../data';

// Verificamos si Amplify tiene configuración válida desplegada
export const isAmplifyConfigured = (): boolean => {
  return Boolean(outputs && outputs.data && outputs.data.url && outputs.data.url.trim() !== '');
};

// Configurar Amplify sólo si existen endpoints reales
if (isAmplifyConfigured()) {
  try {
    Amplify.configure(outputs);
  } catch (err) {
    console.warn('Advertencia configurando Amplify:', err);
  }
}

// Cliente con tipado estricto inferido del backend de Amplify Gen 2 (AppSync + DynamoDB)
const client = generateClient<Schema>();

// Almacén en memoria como respaldo cuando no está conectado a la nube (demo local)
let localCache: FestivalEvent[] = [...initialEvents];

export const eventService = {
  /**
   * Indica si la app está operando en la nube con DynamoDB o en modo local.
   */
  isConnectedToCloud(): boolean {
    return isAmplifyConfigured();
  },

  /**
   * Obtiene todos los eventos desde DynamoDB (o desde la memoria local si no está conectado).
   */
  async listEvents(): Promise<FestivalEvent[]> {
    if (!isAmplifyConfigured()) {
      return [...localCache];
    }

    try {
      const response = await client.models.FestivalEvent.list();
      const items = (response.data || []) as unknown as FestivalEvent[];

      // Si la tabla de DynamoDB está vacía en el primer arranque, sembramos los eventos iniciales
      if (items.length === 0 && localCache.length > 0) {
        for (const item of localCache) {
          await client.models.FestivalEvent.create({
            artist: item.artist,
            space: item.space,
            time: item.time,
            status: item.status,
          });
        }
        const seededResponse = await client.models.FestivalEvent.list();
        return (seededResponse.data || []) as unknown as FestivalEvent[];
      }

      return items;
    } catch (error) {
      console.error('Error al listar eventos desde DynamoDB:', error);
      // Fallback a caché local si la llamada a la nube falla
      return [...localCache];
    }
  },

  /**
   * Crea un nuevo evento en DynamoDB.
   */
  async createEvent(data: { artist: string; space: string; time: string; status: EventStatus }): Promise<FestivalEvent> {
    if (!isAmplifyConfigured()) {
      const newEvent: FestivalEvent = {
        id: 'EVT-' + Date.now().toString().slice(-7),
        artist: data.artist.trim().toUpperCase(),
        space: data.space,
        time: data.time,
        status: data.status,
      };
      localCache = [newEvent, ...localCache];
      return newEvent;
    }

    try {
      const response = await client.models.FestivalEvent.create({
        artist: data.artist.trim().toUpperCase(),
        space: data.space,
        time: data.time,
        status: data.status,
      });

      if (!response.data) {
        throw new Error('No se recibió confirmación de DynamoDB al crear el evento.');
      }

      return response.data as unknown as FestivalEvent;
    } catch (error) {
      console.error('Error al crear evento en DynamoDB:', error);
      throw error;
    }
  },

  /**
   * Actualiza un evento existente en DynamoDB.
   */
  async updateEvent(event: FestivalEvent): Promise<FestivalEvent> {
    if (!isAmplifyConfigured()) {
      localCache = localCache.map((e) => (e.id === event.id ? { ...event } : e));
      return event;
    }

    try {
      const response = await client.models.FestivalEvent.update({
        id: event.id,
        artist: event.artist.trim().toUpperCase(),
        space: event.space,
        time: event.time,
        status: event.status,
      });

      if (!response.data) {
        throw new Error('No se recibió confirmación de DynamoDB al actualizar el evento.');
      }

      return response.data as unknown as FestivalEvent;
    } catch (error) {
      console.error('Error al actualizar evento en DynamoDB:', error);
      throw error;
    }
  },

  /**
   * Elimina un evento de DynamoDB por su ID.
   */
  async deleteEvent(id: string): Promise<void> {
    if (!isAmplifyConfigured()) {
      localCache = localCache.filter((e) => e.id !== id);
      return;
    }

    try {
      await client.models.FestivalEvent.delete({ id });
    } catch (error) {
      console.error('Error al eliminar evento en DynamoDB:', error);
      throw error;
    }
  },

  /**
   * Suscribe en tiempo real a cambios en DynamoDB (AppSync subscription).
   */
  subscribeToEvents(onUpdate: (events: FestivalEvent[]) => void): { unsubscribe: () => void } {
    if (!isAmplifyConfigured()) {
      return { unsubscribe: () => {} };
    }

    try {
      const sub = client.models.FestivalEvent.observeQuery().subscribe({
        next: ({ items }) => {
          onUpdate(items as unknown as FestivalEvent[]);
        },
        error: (err) => {
          console.warn('Error en suscripción en tiempo real de DynamoDB:', err);
        },
      });

      return {
        unsubscribe: () => sub.unsubscribe(),
      };
    } catch (err) {
      console.warn('No se pudo inicializar la suscripción de DynamoDB:', err);
      return { unsubscribe: () => {} };
    }
  },
};

