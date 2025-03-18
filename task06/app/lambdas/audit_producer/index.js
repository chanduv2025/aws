import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "eu-central-1" });
const AUDIT_TABLE = process.env.TARGET_TABLE;

export const handler = async (event) => {
    try {
        console.log("Received event:", JSON.stringify(event, null, 2));

        const records = event.Records;
        const auditEntries = [];

        for (const record of records) {
            const eventName = record.eventName;
            const newImage = unmarshall(record.dynamodb.NewImage || {});
            const oldImage = unmarshall(record.dynamodb.OldImage || {});
            const itemKey = newImage.key || oldImage.key;
            const modificationTime = new Date().toISOString();

            let auditEntry = {
                id: uuidv4(),
                itemKey,
                modificationTime,
                updatedAttribute: "value"
            };

            if (eventName === "INSERT") {
                auditEntry.newValue = newImage;
            } else if (eventName === "MODIFY") {
                auditEntry.oldValue = oldImage.value;
                auditEntry.newValue = newImage.value;
            }

            auditEntries.push(
                dynamoDBClient.send(new PutCommand({
                    TableName: AUDIT_TABLE,
                    Item: auditEntry,
                })).catch(dbError => {
                    console.error("DynamoDB put error:", dbError);
                })
            );
        }

        await Promise.all(auditEntries);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Success" })
        };

    } catch (error) {
        console.error("Error processing request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error", error: error.message }),
        };
    }
};
