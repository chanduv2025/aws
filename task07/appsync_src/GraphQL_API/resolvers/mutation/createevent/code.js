import { util } from '@aws-appsync/utils';

/**
 * Constructs a request to interact with the connected data source.
 * @param {import('@aws-appsync/utils').Context} ctx - The resolver context.
 * @returns {*} The formatted request object.
 */

export function request(ctx) {
    const uniqueId = util.autoId(); // Generate a unique identifier
    const timestamp = util.time.nowISO8601(); // Capture the current timestamp

    return {
        operation: "PutItem",
        key: { id: { S: uniqueId } },
        attributeValues: {
            id: { S: uniqueId },
            userId: { N: ctx.args.userId.toString() },
            createdAt: { S: timestamp },
            dataPayload: util.dynamodb.toMap(ctx.args.payLoad) // ✅ Convert payload into a DynamoDB Map (M)
        }
    };
}

/**
 * Processes and returns the resolver output.
 * @param {import('@aws-appsync/utils').Context} ctx - The resolver context.
 * @returns {*} The transformed response.
 */
export function response(ctx) {
    return ctx.result ? util.dynamodb.toMap(ctx.result) : null;
}
