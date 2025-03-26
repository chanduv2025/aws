import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Initialize the DynamoDB client
const dbClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dbClient);
const AUDIT_TABLE = process.env.TABLE_NAME || "Events";

export const handler = async (event) => {
  console.log("Received event data:", JSON.stringify(event, null, 2));

  const processTasks = event.Records.map(record => handleRecord(record));

  try {
    await Promise.all(processTasks);
    console.log("All records processed successfully");
    return { statusCode: 200, body: "Processing complete" };
  } catch (error) {
    console.error("Error while processing records:", error);
    throw error;
  }
};

/**
 * Handles an individual DynamoDB stream record.
 * @param {Object} record - A single DynamoDB stream record.
 * @returns {Promise} - A promise from the DynamoDB put operation.
 */
async function handleRecord(record) {
  const actionType = record.eventName;
  const dbRecord = record.dynamodb;

  const timestamp = new Date().toISOString();
  const recordKey = dbRecord.Keys.key.S;

  // Construct the audit log entry
  const auditEntry = {
    id: uuidv4(),
    recordKey: recordKey,
    modifiedAt: timestamp
  };

  // Determine the type of event and extract relevant data
  if (actionType === "INSERT") {
    const newData = extractAttributes(dbRecord.NewImage);
    auditEntry.newState = { key: newData.key, value: newData.value };
  } else if (actionType === "MODIFY") {
    const previousData = extractAttributes(dbRecord.OldImage);
    const updatedData = extractAttributes(dbRecord.NewImage);

    auditEntry.previousState = previousData.value;
    auditEntry.newState = updatedData.value;
    auditEntry.changedField = "value"; // Assuming only the "value" field is modified
  } else if (actionType === "REMOVE") {
    const previousData = extractAttributes(dbRecord.OldImage);
    auditEntry.previousState = previousData;
  }

  console.log("Storing audit entry:", JSON.stringify(auditEntry, null, 2));

  const putParams = new PutCommand({
    TableName: AUDIT_TABLE,
    Item: auditEntry
  });

  console.log("Attempting to write audit data to:", putParams.TableName);

  return await documentClient.send(putParams);
}

/**
 * Converts DynamoDB attribute values into a standard JavaScript object.
 * @param {Object} image - DynamoDB attribute representation.
 * @returns {Object} - Converted JavaScript object.
 */
function extractAttributes(image) {
  if (!image) return null;

  const extractedData = {};

  for (const [key, value] of Object.entries(image)) {
    if (value.S !== undefined) {
      extractedData[key] = value.S;
    } else if (value.N !== undefined) {
      extractedData[key] = Number(value.N);
    } else if (value.BOOL !== undefined) {
      extractedData[key] = value.BOOL;
    } else if (value.M !== undefined) {
      extractedData[key] = extractAttributes(value.M);
    } else if (value.L !== undefined) {
      extractedData[key] = value.L.map(item => extractAttributes(item));
    }
  }

  return extractedData;
}
