const axios = require("axios"); // Ensure this is included in Lambda Layer or package.json

exports.handler = async (event) => {
    console.log("Incoming request:", JSON.stringify(event, null, 2));

    const requestPath = event?.rawPath || "/";
    const httpMethod = event?.requestContext?.http?.method || "GET";

    if (httpMethod === "GET" && requestPath === "/weather") {
        try {
            const weatherApiUrl = "https://api.open-meteo.com/v1/forecast?latitude=50.4375&longitude=30.5&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&current_weather=true";
            const weatherResponse = await axios.get(weatherApiUrl);

            return {
                statusCode: 200,
                body: JSON.stringify(weatherResponse.data),
                headers: {
                    "Content-Type": "application/json"
                },
                isBase64Encoded: false
            };
        } catch (err) {
            console.error("Failed to retrieve weather information:", err);
            return {
                statusCode: 500,
                body: JSON.stringify({ message: "Server encountered an error" }),
                headers: {
                    "Content-Type": "application/json"
                },
                isBase64Encoded: false
            };
        }
    } else {
        return {
            statusCode: 400,
            body: JSON.stringify({
                statusCode: 400,
                message: `Invalid request method or path. Requested path: ${requestPath}. HTTP method: ${httpMethod}`
            }),
            headers: {
                "Content-Type": "application/json"
            },
            isBase64Encoded: false
        };
    }
};
