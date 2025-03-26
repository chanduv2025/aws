const AWS = require("aws-sdk");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const WEATHER_TABLE = process.env.TARGET_TABLE || "WeatherData";

async function retrieveWeatherData() {
    const weatherApiUrl = "https://api.open-meteo.com/v1/forecast?latitude=50.4375&longitude=30.5&hourly=temperature_2m";

    try {
        const weatherResponse = await axios.get(weatherApiUrl);
        console.log("Retrieved weather details:", JSON.stringify(weatherResponse.data, null, 2));
        return weatherResponse.data;
    } catch (err) {
        console.error("Error retrieving weather information:", err);
        throw new Error("Unable to fetch weather data");
    }
}

exports.handler = async (event) => {
    try {
        console.log("Incoming event data:", JSON.stringify(event, null, 2));

        const weatherDetails = await retrieveWeatherData();

        const record = {
            id: uuidv4(),
            forecast: {
                latitude: weatherDetails.latitude,
                longitude: weatherDetails.longitude,
                generationTime: weatherDetails.generationtime_ms,
                utcOffset: weatherDetails.utc_offset_seconds,
                timezone: weatherDetails.timezone,
                timezoneAbbr: weatherDetails.timezone_abbreviation,
                elevation: weatherDetails.elevation,
                hourlyUnits: weatherDetails.hourly_units,
                hourlyData: weatherDetails.hourly
            }
        };

        console.log("Storing weather record in DynamoDB:", JSON.stringify(record, null, 2));

        await dynamoDB.put({
            TableName: WEATHER_TABLE,
            Item: record
        }).promise().then(() => {
            console.log("Data successfully stored in DynamoDB");
        }).catch(error => {
            console.error("Error saving data to DynamoDB:", error);
            throw new Error("Failed to write weather information to database");
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Weather data successfully saved!" }),
            headers: { "Content-Type": "application/json" }
        };

    } catch (err) {
        console.error("Error handling request:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Server Error", error: err.message }),
            headers: { "Content-Type": "application/json" }
        };
    }
};
