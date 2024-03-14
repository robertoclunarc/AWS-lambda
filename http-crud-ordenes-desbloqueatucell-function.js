import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

const dynamo = DynamoDBDocumentClient.from(client);

const tableName = "Dynamo_Ordenes-db";

export const handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    switch (event.routeKey) {
      case "DELETE /ordenes/{id}":
        await dynamo.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
          })
        );
        body = `Deleted item ${event.pathParameters.id}`;
        break;
      case "GET /ordenes/{id}":
        body = await dynamo.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              id: parseInt(event.pathParameters.id),
            },
          })
        );
        body = body.Item;
        break;
        case "GET /ordenes/ticket/{id_ticket}":
        body = await dynamo.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              "id_ticket": event.pathParameters.id_ticket,
            },
          })
        );
        body = body.Item;
        break;
      case "GET /ordenes":
        body = await dynamo.send(
          new ScanCommand({ TableName: tableName })
        );
        body = body.Items;
        break;
      case "PUT /ordenes":
        let requestJSON = JSON.parse(event.body);
        await dynamo.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              id: requestJSON.id,
              id_ticket: requestJSON.id_ticket,
              date: requestJSON.date,
              email: requestJSON.email,
              imei: requestJSON.imei,
              id_payment: requestJSON.id_payment,
              price: requestJSON.price,
              estatus: requestJSON.estatus,
              dataComplete: requestJSON.dataComplete,
              id_session: requestJSON.id_session,
              id_terminal: requestJSON.id_terminal,
              id_operador: requestJSON.id_operador,
            },
          })
        );
        body = `Put item ${requestJSON.id}`;
        break;
      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};