exports.handler = async (event) => {
    // TODO implement

    console.log("SNS Event Received:", JSON.stringify(event, null, 2));

        event.Records.forEach(record => {
            console.log("SNS Message:", record.Sns.Message);
        });
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};