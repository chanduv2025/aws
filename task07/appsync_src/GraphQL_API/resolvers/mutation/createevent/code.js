import { util } from '@aws-appsync/utils';

/**
 * Sends a request to the attached data source
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the request
 */
export function request(ctx) {
    const id = util.autoId(); // Generate UUID
    const createdAt = util.time.nowISO8601(); // Generate timestamp

    return {
        operation: "PutItem",
        key: { id: { S: id } },
        attributeValues: {
            id: { S: id },
            userId: { N: ctx.args.userId.toString() },
            createdAt: { S: createdAt },
            payLoad: util.dynamodb.toMap(ctx.args.payLoad) // ✅ Store payLoad as a Map (M)
        }
    };
}

/**
 * Returns the resolver result
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} the result
 */
export function response(ctx) {
    return ctx.result ? util.dynamodb.toMap(ctx.result) : null;
}

