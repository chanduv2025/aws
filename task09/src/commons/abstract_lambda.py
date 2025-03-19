from abc import ABC, abstractmethod
from commons import ApplicationException, create_response
from commons.log_helper import get_logger

logger = get_logger('abstract-lambda')


class BaseLambda(ABC):

    @abstractmethod
    def validate_request(self, event) -> dict:
        """
        Validates incoming event attributes.
        :param event: Lambda event data.
        :return: Dictionary with attribute_name as key and error_message as value.
        """
        pass

    @abstractmethod
    def process_request(self, event, context):
        """
        Business logic for handling the request.
        :param event: Lambda event data.
        :param context: Lambda execution context.
        :return: Execution result.
        """
        pass

    def lambda_handler(self, event, context):
        try:
            logger.debug(f"Incoming request: {event}")

            # Ignore warm-up events
            if event.get('warm_up'):
                return None

            # Validate request
            validation_errors = self.validate_request(event)
            if validation_errors:
                return create_response(data=validation_errors, status=400)

            # Process request
            result = self.process_request(event, context)
            logger.debug(f"Response generated: {result}")

            return result

        except ApplicationException as exc:
            logger.error(f"Application error; Event: {event}; Error: {exc}")
            return create_response(data=exc.content, status=exc.code)

        except Exception as exc:
            logger.error(f"Unexpected error; Event: {event}; Error: {exc}")
            return create_response(data="Internal server error", status=500)
