from commons.log_helper import get_logger
from commons.abstract_lambda import AbstractLambda
from decimal import Decimal

import requests

_LOG = get_logger('Processor-handler')

import json
import os
import uuid
import boto3
from datetime import datetime


class Processor(AbstractLambda):

    def validate_request(self, event) -> dict:
        pass

    def handle_request(self, event, context):
        """
        Explain incoming event here
        """
        response = {
            'statusCode': 200,
            'headers': {
                "Content-Type": "application/json"
            },
            'body': {}
        }
        try:

            api_response = requests.get(
                'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m')
            api_response.raise_for_status()  # Check for HTTP request errors
            data = api_response.json()
            db_item = self.format_weather_forecast(data)
            response['body'] = str(db_item)
            self.handle_insert(db_item)
        except Exception as e:
            _LOG.error(e)
            response['statusCode'] = 500
            response['body'] = str(e)
        return response

    def handle_insert(self, db_item):
        _LOG.info('inside handle_insert method')

        dynamodb = boto3.resource('dynamodb')
        db_table = dynamodb.Table(os.environ.get('table_name', "Weather"))

        try:
            _LOG.info('performing insert...')
            resp = db_table.put_item(Item=db_item)
            _LOG.info(resp)
        except Exception as e:
            _LOG.error('error in db insert action')
            _LOG.error(e)

    # Function to convert float values to Decimal recursively
    def convert_float_to_decimal(self, obj):
        if isinstance(obj, float):
            return Decimal(str(obj))  # Convert float to Decimal
        elif isinstance(obj, dict):
            return {k: self.convert_float_to_decimal(v) for k, v in obj.items()}  # Recursive call for dicts
        elif isinstance(obj, list):
            return [self.convert_float_to_decimal(i) for i in obj]  # Recursive call for lists
        return obj  # Return value if it's not a float

    # Function to transform API response to match the desired JSON format
    def format_weather_forecast(self, api_response):
        # Generate a UUIDv4 for the 'id' field
        formatted_response = {
            "id": str(uuid.uuid4()),  # Generate unique UUID
            "forecast": {
                "elevation": api_response.get("elevation", None),  # Fetch 'elevation' from API response
                "generationtime_ms": api_response.get("generationtime_ms", None),  # Fetch 'generationtime_ms'
                "hourly": {
                    "temperature_2m": api_response["hourly"].get("temperature_2m", []),  # List of temperatures
                    "time": api_response["hourly"].get("time", [])  # List of time values
                },
                "hourly_units": {
                    "temperature_2m": api_response["hourly_units"].get("temperature_2m", ""),  # Unit for temperature
                    "time": api_response["hourly_units"].get("time", "")  # Unit for time
                },
                "latitude": api_response.get("latitude", None),  # Fetch latitude
                "longitude": api_response.get("longitude", None),  # Fetch longitude
                "timezone": api_response.get("timezone", ""),  # Fetch timezone
                "timezone_abbreviation": api_response.get("timezone_abbreviation", ""),  # Fetch timezone abbreviation
                "utc_offset_seconds": api_response.get("utc_offset_seconds", None)  # Fetch UTC offset in seconds
            }
        }
        # Convert all float values to Decimal
        formatted_response = self.convert_float_to_decimal(formatted_response)
        return formatted_response


HANDLER = Processor()


def lambda_handler(event, context):
    return HANDLER.lambda_handler(event=event, context=context)
