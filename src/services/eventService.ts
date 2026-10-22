import { FestivalEvent, EventStatus, initialEvents } from '../data';
import { API_CONFIG } from '../config';

// Almacén local en memoria cuando no hay API configurada
let localCache: FestivalEvent[] = [...initialEvents];

/**
 * Servicio unificado para gestionar eventos con Amazon DynamoDB.
 * Compatible con AWS Academy (vía API Gateway + Lambda + DynamoDB)
 * y con modo local/demostración.
 */
export const eventService = {
  /**
   * Comprueba si hay una conexión configurada con el backend en la nube.
   */
  isConnectedToCloud(): boolean {
    return Boolean(API_CONFIG.apiUrl && API_CONFIG.apiUrl.trim().startsWith('http'));
  },

  /**
   * Obtiene la lista de eventos desde DynamoDB a través del API Gateway.
   */
  async listEvents(): Promise<FestivalEvent[]> {
    if (!this.isConnectedToCloud()) {
      return [...localCache];
    }

    try {
      const res = await fetch(API_CONFIG.apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const items: FestivalEvent[] = await res.json();

      // Si la tabla de DynamoDB está vacía en el primer arranque, sembramos los eventos iniciales
      if (items.length === 0 && localCache.length > 0) {
        for (const item of localCache) {
          await this.createEvent({
            artist: item.artist,
            space: item.space,
            time: item.time,
            status: item.status,
          });
        }
        const seededRes = await fetch(API_CONFIG.apiUrl, { method: 'GET' });
        return (await seededRes.json()) as FestivalEvent[];
      }

      return items;
    } catch (error) {
      console.warn('No se pudo conectar con la API de DynamoDB, usando caché local:', error);
      return [...localCache];
    }
  },

  /**
   * Crea un nuevo evento en DynamoDB.
   */
  async createEvent(data: { artist: string; space: string; time: string; status: EventStatus }): Promise<FestivalEvent> {
    if (!this.isConnectedToCloud()) {
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
      const res = await fetch(API_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`Error al crear en DynamoDB: ${res.status}`);
      }

      const createdItem: FestivalEvent = await res.json();
      return createdItem;
    } catch (error) {
      console.error('Error creando evento:', error);
      throw error;
    }
  },

  /**
   * Actualiza un evento en DynamoDB.
   */
  async updateEvent(event: FestivalEvent): Promise<FestivalEvent> {
    if (!this.isConnectedToCloud()) {
      localCache = localCache.map((e) => (e.id === event.id ? { ...event } : e));
      return event;
    }

    try {
      const res = await fetch(API_CONFIG.apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        throw new Error(`Error al actualizar en DynamoDB: ${res.status}`);
      }

      const updatedItem: FestivalEvent = await res.json();
      return updatedItem;
    } catch (error) {
      console.error('Error actualizando evento:', error);
      throw error;
    }
  },

  /**
   * Elimina un evento de DynamoDB.
   */
  async deleteEvent(id: string): Promise<void> {
    if (!this.isConnectedToCloud()) {
      localCache = localCache.filter((e) => e.id !== id);
      return;
    }

    try {
      const res = await fetch(`${API_CONFIG.apiUrl}?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Error al eliminar de DynamoDB: ${res.status}`);
      }
    } catch (error) {
      console.error('Error eliminando evento:', error);
      throw error;
    }
  },

  /**
   * Polling periódico para simular actualización en tiempo real cuando hay conexión activa.
   */
  subscribeToEvents(onUpdate: (events: FestivalEvent[]) => void): { unsubscribe: () => void } {
    if (!this.isConnectedToCloud()) {
      return { unsubscribe: () => {} };
    }

    const interval = setInterval(async () => {
      try {
        const events = await this.listEvents();
        onUpdate(events);
      } catch (err) {
        // Silencio en polling de fondo
      }
    }, 5000);

    return {
      unsubscribe: () => clearInterval(interval),
    };
  },
};
