exports.handler = async (event) => {
    // TODO implement
    console.log("SQS Event Received:", JSON.stringify(event, null, 2));

        event.Records.forEach(record => {
            console.log("SQS Message Body:", record.body);
        });
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};