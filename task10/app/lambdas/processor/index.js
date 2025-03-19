const AWS = require("aws-sdk");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TARGET_TABLE || "Weather";

const fetchWeatherData = async () => {
    const endpoint = "https://api.open-meteo.com/v1/forecast?latitude=50.4375&longitude=30.5&hourly=temperature_2m";

    try {
        const { data } = await axios.get(endpoint);
        console.log("Weather data retrieved:", JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error("Error retrieving weather data:", error.message);
        throw new Error("Unable to retrieve weather data");
    }
};

exports.handler = async (event) => {
    console.log("Incoming event:", JSON.stringify(event, null, 2));

    try {
        const weatherData = await fetchWeatherData();

        const record = {
            id: uuidv4(),
            forecast: {
                latitude: weatherData.latitude,
                longitude: weatherData.longitude,
                generationTime: weatherData.generationtime_ms,
                utcOffset: weatherData.utc_offset_seconds,
                timezone: weatherData.timezone,
                timezoneAbbreviation: weatherData.timezone_abbreviation,
                elevation: weatherData.elevation,
                hourlyUnits: weatherData.hourly_units,
                hourlyData: weatherData.hourly
            }
        };

        console.log("Inserting record into DynamoDB:", JSON.stringify(record, null, 2));

        await dynamoDB.put({
            TableName: TABLE_NAME,
            Item: record
        }).promise();

        console.log("Record successfully inserted into DynamoDB");

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Weather data saved successfully!" }),
            headers: { "Content-Type": "application/json" }
        };

    } catch (error) {
        console.error("Error handling request:", error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
            headers: { "Content-Type": "application/json" }
        };
    }
};
