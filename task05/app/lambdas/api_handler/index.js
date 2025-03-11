import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const dynamoDBClient = new DynamoDBClient({ region: "eu-central-1" });
const TABLE_NAME = process.env.TARGET_TABLE;

export const handler = async (event) => {
    try {
        console.log("Received event:", JSON.stringify(event, null, 2));

        if (!TABLE_NAME) {
            console.error("TABLE_NAME environment variable is not defined");
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Server configuration error: TABLE_NAME not set" })
            };
        }

        let inputEvent;
        try {
            inputEvent = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        } catch (parseError) {
            console.error("Error parsing event body:", parseError);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid JSON format in request body" }),
            };
        }

        if (!inputEvent?.principalId || typeof inputEvent.principalId !== "number") {
            console.error("Validation failed: principalId must be a number");
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid input: principalId must be a number" }),
            };
        }

        if (!inputEvent?.content || typeof inputEvent.content !== "object") {
            console.error("Validation failed: content must be an object");
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid input: content must be a map object" }),
            };
        }

        const eventId = uuidv4();
        const createdAt = new Date().toISOString();

        const eventItem = {
            id: eventId,
            principalId: inputEvent.principalId,
            createdAt,
            body: inputEvent.content,
        };

        console.log("Saving to DynamoDB:", JSON.stringify(eventItem, null, 2));

        try {
            await dynamoDBClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: eventItem,
            }));
        } catch (dbError) {
            console.error("DynamoDB put error:", JSON.stringify(dbError, null, 2));
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    message: "Failed to save event to DynamoDB", 
                    error: dbError.message,
                    details: dbError 
                }),
            };
        }

        console.log("Saved successfully");

        return {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                event: eventItem
            })
        };

    } catch (error) {
        console.error("Error processing request:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal server error", error: error.message }),
        };
    }
};
