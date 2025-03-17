import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const dynamoDBClient = new DynamoDBClient({ region: "eu-central-1" });
const TABLE_NAME = process.env.TARGET_TABLE ;

export const handler = async (event) => {
    try {
        console.log("Received event:", JSON.stringify(event, null, 2));

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

        if (!inputEvent?.principalId || inputEvent?.content === undefined) {
            console.error("Validation failed: Missing required fields", inputEvent);
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid input: principalId and content are required" }),
            };
        }

        const eventId = uuidv4();
        const createdAt = new Date().toISOString();

        const eventItem = {
            id: eventId,
            principalId: Number(inputEvent.principalId),
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
            console.error("DynamoDB put error:", dbError);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Failed to save event to DynamoDB", error: dbError.message }),
            };
        }

        console.log("Saved successfully");

        return {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                statusCode: 201,
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
