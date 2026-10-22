import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  ScanCommand, 
  PutCommand, 
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "FestivalEvents";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

export const handler = async (event) => {
  // Manejo de preflight CORS (OPTIONS)
  const method = event.requestContext?.http?.method || event.httpMethod;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    // 1. OBTENER TODOS LOS EVENTOS (GET)
    if (method === "GET") {
      const response = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response.Items || [])
      };
    }

    // 2. CREAR UN NUEVO EVENTO (POST)
    if (method === "POST") {
      const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body;
      const item = {
        id: body.id || "EVT-" + Date.now().toString().slice(-7),
        artist: (body.artist || "").trim().toUpperCase(),
        space: body.space || "MAIN STAGE",
        time: body.time || "21:45",
        status: body.status || "CONFIRMED",
        createdAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(item)
      };
    }

    // 3. ACTUALIZAR UN EVENTO EXISTENTE (PUT)
    if (method === "PUT") {
      const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body;
      if (!body.id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el id del evento" }) };
      }

      const item = {
        id: body.id,
        artist: (body.artist || "").trim().toUpperCase(),
        space: body.space,
        time: body.time,
        status: body.status,
        updatedAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(item)
      };
    }

    // 4. ELIMINAR UN EVENTO (DELETE)
    if (method === "DELETE") {
      const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : (event.body || {});
      const id = event.queryStringParameters?.id || body.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el id del evento" }) };
      }

      await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { id } }));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, id })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: `Método ${method} no permitido` })
    };
  } catch (error) {
    console.error("Error en Lambda con DynamoDB:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || String(error) })
    };
  }
};

