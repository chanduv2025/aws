import { util } from '@aws-appsync/utils';

/**
 * Constructs a request to fetch data from the linked data source.
 * @param {import('@aws-appsync/utils').Context} ctx - The resolver context.
 * @returns {*} The formatted request object.
 */
export function request(ctx) {
    return {
        operation: 'GetItem',
        key: {
            id: { S: ctx.args.id }
        }
    };
}

/**
 * Processes and returns the retrieved data.
 * @param {import('@aws-appsync/utils').Context} ctx - The resolver context.
 * @returns {*} The structured response.
 */
export function response(ctx) {
    return ctx.result ? util.dynamodb.toMap(ctx.result) : null;
}
